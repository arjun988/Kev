import type {
  Answer,
  Question,
  QuestionTrace,
  State,
  SystemOneRequest,
  SystemOneResponse,
} from "@kev-ai/schema";
import { formatState } from "@kev-ai/schema";
import {
  DecisionEngine,
  type DecisionStrategy,
  type EngineConfig,
  type InferenceBackend,
} from "./engine.js";
import type { CalibrationProfile } from "./calibration.js";

export type EvaluateOptions = EngineConfig & {
  backend: InferenceBackend;
};

/**
 * Evaluate all questions in a System One request in parallel.
 */
export async function evaluateSystemOne(
  request: SystemOneRequest,
  options: EvaluateOptions,
): Promise<SystemOneResponse> {
  const started = Date.now();
  const engine = new DecisionEngine(options.backend, {
    modelName: options.modelName,
    calibration: options.calibration,
    strategy: options.strategy,
  });

  const entries = Object.entries(request.questions);
  const results = await Promise.all(
    entries.map(async ([name, question]) => {
      const result = await engine.evaluateQuestion(request.state, question);
      return { name, result };
    }),
  );

  const answers: Record<string, Answer> = {};
  const trace: Record<string, QuestionTrace> = {};
  let inputTokens = 0;
  let outputTokens = 0;

  for (const { name, result } of results) {
    answers[name] = result.answer;
    trace[name] = result.trace;
    inputTokens += result.usage.inputTokens;
    outputTokens += result.usage.outputTokens;
  }

  // Rough token estimate if backend reported zeros (e.g. some local servers)
  if (inputTokens === 0) {
    const stateLen = formatState(request.state).length;
    inputTokens = Math.ceil(stateLen / 4) * entries.length;
  }

  const response: SystemOneResponse = {
    model: options.modelName,
    answers,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: Date.now() - started,
    },
  };

  if (request.trace) {
    response.trace = trace;
  }

  return response;
}

export type { DecisionStrategy, InferenceBackend, State, Question, CalibrationProfile };
