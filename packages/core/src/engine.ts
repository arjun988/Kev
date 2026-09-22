import type {
  Answer,
  ChoiceAnswer,
  ChoiceQuestion,
  NoulAnswer,
  NoulQuestion,
  Question,
  QuestionTrace,
  ScoreAnswer,
  ScoreQuestion,
  State,
} from "@kev-ai/schema";
import {
  confidenceFromDistribution,
  pickArgmax,
  resolveCalibrationProfile,
  softmax,
  weightedScore,
  type CalibrationProfile,
} from "./calibration.js";
import {
  buildConstrainedPrompt,
  buildMicroScorePrompt,
  buildReadoutPrompt,
  choiceOptions,
  noulOptions,
  scoreOptions,
  type PromptOption,
} from "./prompts.js";

export type DecisionStrategy = "auto" | "readout" | "constrained" | "parallel" | "mock";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LogprobToken = {
  token: string;
  logprob: number;
};

export type CompletionResult = {
  text: string;
  /** Top logprobs at the first generated token, if available */
  topLogprobs?: LogprobToken[];
  usage: { inputTokens: number; outputTokens: number };
};

export type BackendCapabilities = {
  name: string;
  supportsLogprobs: boolean;
  supportsJsonMode: boolean;
};

/**
 * Minimal interface every inference backend must implement.
 */
export interface InferenceBackend {
  readonly capabilities: BackendCapabilities;
  complete(args: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
    logprobs?: boolean;
    topLogprobs?: number;
    responseFormat?: "text" | "json";
  }): Promise<CompletionResult>;
}

export type EngineConfig = {
  modelName: string;
  calibration?: string | Partial<CalibrationProfile>;
  strategy?: DecisionStrategy;
};

export type EngineResult = {
  answer: Answer;
  usage: { inputTokens: number; outputTokens: number };
  trace: QuestionTrace;
};

function optionsFor(question: Question): PromptOption[] {
  switch (question.type) {
    case "choice":
      return choiceOptions(question);
    case "score":
      return scoreOptions(question);
    case "noul":
      return noulOptions(question);
  }
}

function extractLetterLogprobs(
  topLogprobs: LogprobToken[] | undefined,
  options: PromptOption[],
): Record<string, number> | null {
  if (!topLogprobs || topLogprobs.length === 0) return null;

  const scores: Record<string, number> = {};
  for (const opt of options) {
    scores[opt.key] = Number.NEGATIVE_INFINITY;
  }

  let found = false;
  for (const entry of topLogprobs) {
    const cleaned = entry.token.trim();
    if (!cleaned) continue;
    // Match first character that is a letter option
    const ch = cleaned[0]!;
    const opt = options.find((o) => o.letter === ch);
    if (opt) {
      const prev = scores[opt.key]!;
      if (entry.logprob > prev) {
        scores[opt.key] = entry.logprob;
        found = true;
      }
    }
  }

  if (!found) {
    // Fallback: try full token match like "A" or " A"
    for (const entry of topLogprobs) {
      const cleaned = entry.token.trim();
      const opt = options.find((o) => o.letter === cleaned);
      if (opt) {
        scores[opt.key] = entry.logprob;
        found = true;
      }
    }
  }

  if (!found) return null;

  // Fill missing with a large negative relative to the best found
  const finite = Object.values(scores).filter((v) => Number.isFinite(v));
  const floor = finite.length ? Math.min(...finite) - 10 : -20;
  for (const opt of options) {
    if (!Number.isFinite(scores[opt.key]!)) {
      scores[opt.key] = floor;
    }
  }
  return scores;
}

function parseMicroP(text: string): number {
  const trimmed = text.trim();
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]) as { p?: unknown };
      if (typeof obj.p === "number" && Number.isFinite(obj.p)) {
        return Math.min(1, Math.max(0, obj.p));
      }
    }
  } catch {
    // fall through
  }
  const num = Number.parseFloat(trimmed);
  if (Number.isFinite(num)) return Math.min(1, Math.max(0, num));
  return 0.5;
}

function parseConstrainedChoice(
  text: string,
  options: PromptOption[],
): { key: string; confidence: number } {
  const keys = new Set(options.map((o) => o.key));
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]) as {
        choice?: unknown;
        confidence?: unknown;
      };
      if (typeof obj.choice === "string" && keys.has(obj.choice)) {
        const confidence =
          typeof obj.confidence === "number"
            ? Math.min(1, Math.max(0, obj.confidence))
            : 0.5;
        return { key: obj.choice, confidence };
      }
    }
  } catch {
    // fall through
  }
  // Letter fallback
  const letter = text.trim()[0];
  const byLetter = options.find((o) => o.letter === letter);
  if (byLetter) return { key: byLetter.key, confidence: 0.5 };
  return { key: options[0]!.key, confidence: 0.3 };
}

function toChoiceAnswer(
  probabilities: Record<string, number>,
): ChoiceAnswer {
  return {
    type: "choice",
    choice: pickArgmax(probabilities),
    confidence: confidenceFromDistribution(probabilities),
    probabilities,
  };
}

function toScoreAnswer(
  question: ScoreQuestion,
  probabilities: Record<string, number>,
): ScoreAnswer {
  const legend: Record<string, string> = {};
  question.criteria.forEach((desc, i) => {
    legend[String(i)] = desc;
  });
  return {
    type: "score",
    score: weightedScore(probabilities),
    confidence: confidenceFromDistribution(probabilities),
    legend,
    probabilities,
  };
}

function toNoulAnswer(probabilities: Record<string, number>): NoulAnswer {
  return {
    type: "noul",
    noul: probabilities["true"] ?? 0.5,
  };
}

function finalizeAnswer(
  question: Question,
  probabilities: Record<string, number>,
): Answer {
  switch (question.type) {
    case "choice":
      return toChoiceAnswer(probabilities);
    case "score":
      return toScoreAnswer(question, probabilities);
    case "noul":
      return toNoulAnswer(probabilities);
  }
}

export class DecisionEngine {
  private readonly calibration: CalibrationProfile;
  private readonly strategy: DecisionStrategy;
  readonly modelName: string;

  constructor(
    private readonly backend: InferenceBackend,
    config: EngineConfig,
  ) {
    this.modelName = config.modelName;
    this.calibration = resolveCalibrationProfile(config.calibration);
    this.strategy = config.strategy ?? "auto";
  }

  async evaluateQuestion(
    state: State,
    question: Question,
  ): Promise<EngineResult> {
    const resolved = this.resolveStrategy();
    switch (resolved) {
      case "readout":
        return this.runReadout(state, question);
      case "parallel":
        return this.runParallel(state, question);
      case "constrained":
        return this.runConstrained(state, question);
      default: {
        const _exhaustive: never = resolved;
        throw new Error(`unsupported strategy: ${_exhaustive}`);
      }
    }
  }

  private resolveStrategy(): Exclude<DecisionStrategy, "auto" | "mock"> {
    if (this.strategy !== "auto") {
      if (this.strategy === "mock") {
        throw new Error("use MockBackend for mock strategy");
      }
      return this.strategy;
    }
    if (this.backend.capabilities.supportsLogprobs) return "readout";
    if (this.backend.capabilities.supportsJsonMode) return "constrained";
    return "parallel";
  }

  private async runReadout(
    state: State,
    question: Question,
  ): Promise<EngineResult> {
    const options = optionsFor(question);
    const { system, user } = buildReadoutPrompt({
      state,
      instructions: question.instructions,
      options,
      kind: question.type,
    });

    let result;
    try {
      result = await this.backend.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        maxTokens: 1,
        temperature: 0,
        logprobs: true,
        topLogprobs: Math.min(20, Math.max(5, options.length * 2)),
      });
    } catch (err) {
      // Provider rejected logprobs — fall back automatically
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "logprobs_unsupported") {
        return this.runConstrained(state, question);
      }
      throw err;
    }

    let rawScores = extractLetterLogprobs(result.topLogprobs, options);

    // If logprobs missing, fall back to constrained decode
    if (!rawScores) {
      return this.runConstrained(state, question);
    }

    // Apply noul bias on the yes logit
    if (question.type === "noul" && this.calibration.noulBias !== 0) {
      rawScores = {
        ...rawScores,
        true: (rawScores["true"] ?? 0) + this.calibration.noulBias,
      };
    }

    const temperature =
      question.type === "noul"
        ? this.calibration.noulTemperature
        : this.calibration.readoutTemperature;

    const probabilities = softmax(
      rawScores,
      temperature,
      this.calibration.epsilon,
    );

    return {
      answer: finalizeAnswer(question, probabilities),
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      trace: {
        strategy: "readout",
        backend: this.backend.capabilities.name,
        option_keys: options.map((o) => o.key),
        raw_scores: rawScores,
      },
    };
  }

  private async runParallel(
    state: State,
    question: Question,
  ): Promise<EngineResult> {
    const options = optionsFor(question);
    const results = await Promise.all(
      options.map(async (opt) => {
        const { system, user } = buildMicroScorePrompt({
          state,
          instructions: question.instructions,
          optionKey: opt.key,
          optionDescription: opt.description,
        });
        const completion = await this.backend.complete({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          maxTokens: 32,
          temperature: 0,
          responseFormat: this.backend.capabilities.supportsJsonMode
            ? "json"
            : "text",
        });
        return {
          key: opt.key,
          p: parseMicroP(completion.text),
          usage: completion.usage,
        };
      }),
    );

    const rawScores: Record<string, number> = {};
    let inputTokens = 0;
    let outputTokens = 0;
    for (const r of results) {
      // Convert probability to a logit-ish score for softmax
      const p = Math.min(1 - 1e-6, Math.max(1e-6, r.p));
      rawScores[r.key] = Math.log(p / (1 - p));
      inputTokens += r.usage.inputTokens;
      outputTokens += r.usage.outputTokens;
    }

    const temperature =
      question.type === "noul"
        ? this.calibration.noulTemperature
        : this.calibration.readoutTemperature;

    const probabilities = softmax(
      rawScores,
      temperature,
      this.calibration.epsilon,
    );

    return {
      answer: finalizeAnswer(question, probabilities),
      usage: { inputTokens, outputTokens },
      trace: {
        strategy: "parallel",
        backend: this.backend.capabilities.name,
        option_keys: options.map((o) => o.key),
        raw_scores: rawScores,
      },
    };
  }

  private async runConstrained(
    state: State,
    question: Question,
  ): Promise<EngineResult> {
    const options = optionsFor(question);
    const { system, user } = buildConstrainedPrompt({
      state,
      instructions: question.instructions,
      options,
      kind: question.type,
    });

    const result = await this.backend.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 64,
      temperature: 0,
      responseFormat: this.backend.capabilities.supportsJsonMode
        ? "json"
        : "text",
    });

    const parsed = parseConstrainedChoice(result.text, options);
    // Build a peaked distribution around the chosen key
    const rawScores: Record<string, number> = {};
    for (const opt of options) {
      rawScores[opt.key] = opt.key === parsed.key ? 2 + parsed.confidence : 0;
    }
    const probabilities = softmax(
      rawScores,
      this.calibration.readoutTemperature,
      this.calibration.epsilon,
    );

    return {
      answer: finalizeAnswer(question, probabilities),
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
      trace: {
        strategy: "constrained",
        backend: this.backend.capabilities.name,
        option_keys: options.map((o) => o.key),
        raw_scores: rawScores,
      },
    };
  }
}

export type {
  CalibrationProfile,
  ChoiceQuestion,
  NoulQuestion,
  ScoreQuestion,
};
