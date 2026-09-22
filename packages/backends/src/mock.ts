import type {
  BackendCapabilities,
  ChatMessage,
  CompletionResult,
  InferenceBackend,
} from "@kev-ai/core";
import {
  confidenceFromDistribution,
  pickArgmax,
  softmax,
  weightedScore,
} from "@kev-ai/core";
import type {
  Answer,
  Question,
  QuestionTrace,
  State,
  SystemOneRequest,
  SystemOneResponse,
} from "@kev-ai/schema";
import { formatState } from "@kev-ai/schema";

/**
 * Deterministic mock backend for local development and tests.
 * Uses simple keyword / heuristic scoring — no network calls.
 */
export class MockBackend implements InferenceBackend {
  readonly capabilities: BackendCapabilities = {
    name: "mock",
    supportsLogprobs: false,
    supportsJsonMode: false,
  };

  async complete(_args: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
    logprobs?: boolean;
    topLogprobs?: number;
    responseFormat?: "text" | "json";
  }): Promise<CompletionResult> {
    return {
      text: "A",
      usage: { inputTokens: 0, outputTokens: 1 },
    };
  }
}

/** Tokenize into alphanumeric words length > 2. */
function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/**
 * True if needle appears in hay, or shares a stem prefix (min 4 chars),
 * so "charge" matches "charged" / "charges".
 */
function fuzzyIncludes(hay: string, needle: string): boolean {
  if (!needle) return false;
  if (hay.includes(needle)) return true;
  if (needle.length < 4) return false;
  const stem = needle.slice(0, Math.min(needle.length, 6));
  return hay.includes(stem);
}

function keywordScore(stateText: string, text: string | null): number {
  if (!text) return 0;
  const hay = stateText.toLowerCase();
  const tokens = tokensOf(text);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (fuzzyIncludes(hay, t)) hits += 1;
  }
  return hits / tokens.length;
}

/** Extra weight when state clearly matches a known option family. */
function domainBoost(stateLower: string, key: string): number {
  const k = key.toLowerCase();
  if (
    k === "billing" &&
    /charg|invoice|refund|payment|credit.?card|billed|money|price|cost/.test(
      stateLower,
    )
  ) {
    return 1.2;
  }
  if (
    (k === "bug" || k === "technical" || k === "tech") &&
    /bug|crash|error|500|outage|broken|fail/.test(stateLower)
  ) {
    return 1.2;
  }
  if (
    (k === "shipping" || k === "delivery") &&
    /ship|deliver|package|tracking|courier/.test(stateLower)
  ) {
    return 1.2;
  }
  if (
    k === "account" &&
    /login|password|sign.?in|username|access denied|locked out/.test(stateLower)
  ) {
    return 1.2;
  }
  return 0;
}

function mockAnswer(state: State, question: Question): {
  answer: Answer;
  raw: Record<string, number>;
} {
  const stateText = formatState(state);
  const lower = stateText.toLowerCase();

  if (question.type === "choice") {
    const raw: Record<string, number> = {};
    for (const [key, desc] of Object.entries(question.criteria)) {
      const fromDesc = keywordScore(stateText, desc);
      const fromKey = keywordScore(stateText, key);
      const keyHit = lower.includes(key.toLowerCase()) ? 0.8 : 0;
      raw[key] =
        fromDesc * 1.0 + fromKey * 0.6 + keyHit + domainBoost(lower, key);
    }
    // Tiny deterministic tie-break so argmax is stable, never dominates signal
    for (const key of Object.keys(raw)) {
      let h = 0;
      const s = stateText + key;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      raw[key] = (raw[key] ?? 0) + (Math.abs(h) % 100) / 100_000;
    }
    const probabilities = softmax(raw, 0.5);
    return {
      answer: {
        type: "choice",
        choice: pickArgmax(probabilities),
        confidence: confidenceFromDistribution(probabilities),
        probabilities,
      },
      raw,
    };
  }

  if (question.type === "score") {
    const raw: Record<string, number> = {};
    const urgent = /urgent|asap|furious|immediately|critical|angry|now/.test(
      lower,
    );
    question.criteria.forEach((desc, i) => {
      const kw = keywordScore(stateText, desc);
      const urgency = urgent
        ? i * 0.35
        : (question.criteria.length - 1 - i) * 0.15;
      raw[String(i)] = kw + urgency + 0.1;
    });
    const probabilities = softmax(raw, 0.6);
    const legend: Record<string, string> = {};
    question.criteria.forEach((d, i) => {
      legend[String(i)] = d;
    });
    return {
      answer: {
        type: "score",
        score: weightedScore(probabilities),
        confidence: confidenceFromDistribution(probabilities),
        legend,
        probabilities,
      },
      raw,
    };
  }

  // noul
  let yes = 0.35;
  if (/urgent|asap|furious|immediately|critical|angry|escalate|human/.test(lower)) {
    yes += 0.4;
  }
  if (/charg|refund|invoice|twice|cancel/.test(lower)) {
    yes += 0.15;
  }
  if (/not urgent|all good|thanks|resolved/.test(lower)) {
    yes -= 0.3;
  }
  yes = Math.min(0.98, Math.max(0.02, yes));
  const raw = { true: Math.log(yes / (1 - yes)), false: 0 };
  const probabilities = softmax(raw, 1);
  return {
    answer: { type: "noul", noul: probabilities["true"] ?? yes },
    raw,
  };
}

/**
 * Evaluate a full System One request using deterministic heuristics.
 * Bypasses the LLM DecisionEngine for zero-dependency local demos.
 */
export async function evaluateWithMock(
  request: SystemOneRequest,
  modelName = "kev-mock",
): Promise<SystemOneResponse> {
  const started = Date.now();
  const answers: Record<string, Answer> = {};
  const trace: Record<string, QuestionTrace> = {};

  for (const [name, question] of Object.entries(request.questions)) {
    const { answer, raw } = mockAnswer(request.state, question);
    answers[name] = answer;
    trace[name] = {
      strategy: "mock",
      backend: "mock",
      raw_scores: raw,
    };
  }

  const stateLen = formatState(request.state).length;
  const response: SystemOneResponse = {
    model: modelName,
    answers,
    usage: {
      input_tokens: Math.ceil(stateLen / 4),
      output_tokens: 0,
      latency_ms: Date.now() - started,
    },
  };
  if (request.trace) response.trace = trace;
  return response;
}
