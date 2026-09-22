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
import { LruCache, stableHash } from "./cache.js";

export type EvaluateOptions = EngineConfig & {
  backend: InferenceBackend;
  /** Optional shared response cache (prefix / identical request reuse) */
  cache?: LruCache<SystemOneResponse>;
};

function requestCacheKey(
  request: SystemOneRequest,
  modelName: string,
): string {
  return stableHash(
    JSON.stringify({
      model: modelName,
      state: request.state,
      questions: request.questions,
      trace: Boolean(request.trace),
    }),
  );
}

/**
 * Evaluate all questions in a System One request in parallel.
 */
export async function evaluateSystemOne(
  request: SystemOneRequest,
  options: EvaluateOptions,
): Promise<SystemOneResponse> {
  const started = Date.now();
  const cacheKey = requestCacheKey(request, options.modelName);

  if (!request.no_cache && options.cache) {
    const hit = options.cache.get(cacheKey);
    if (hit) {
      return {
        ...hit,
        usage: {
          ...hit.usage,
          latency_ms: Date.now() - started,
          cache_hit: true,
        },
      };
    }
  }

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
      cache_hit: false,
    },
  };

  if (request.trace) {
    response.trace = trace;
  }

  if (!request.no_cache && options.cache) {
    options.cache.set(cacheKey, response);
  }

  return response;
}

export type {
  DecisionStrategy,
  InferenceBackend,
  State,
  Question,
  CalibrationProfile,
};
