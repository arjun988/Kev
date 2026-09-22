import {
  createBackend,
  evaluateWithMock,
  type BackendKind,
} from "@kev-ai/backends";
import {
  evaluateSystemOne,
  LruCache,
  type DecisionStrategy,
} from "@kev-ai/core";
import type {
  BatchRequest,
  BatchResponse,
  SystemOneRequest,
  SystemOneResponse,
} from "@kev-ai/schema";
import type { ServerEnv } from "./config.js";

export function resolveModelName(
  env: ServerEnv,
  requested?: string,
): string {
  if (requested && requested !== "kev-latest" && requested !== "jev-latest") {
    return requested;
  }
  if (env.KEV_BACKEND === "mock") return "kev-mock";
  if (env.KEV_BACKEND === "ollama") return `kev-ollama/${env.KEV_OLLAMA_MODEL}`;
  return `kev-openai/${env.KEV_OPENAI_MODEL}`;
}

export type DecisionService = {
  systemOne: (request: SystemOneRequest) => Promise<SystemOneResponse>;
  batch: (request: BatchRequest) => Promise<BatchResponse>;
};

export function createDecisionService(env: ServerEnv): DecisionService {
  const cache =
    env.KEV_CACHE_SIZE > 0
      ? new LruCache<SystemOneResponse>(env.KEV_CACHE_SIZE)
      : undefined;

  async function systemOne(
    request: SystemOneRequest,
  ): Promise<SystemOneResponse> {
    const modelName = resolveModelName(env, request.model);
    if (env.KEV_BACKEND === "mock" || env.KEV_STRATEGY === "mock") {
      const res = await evaluateWithMock(request, modelName);
      return res;
    }

    const kind = env.KEV_BACKEND as BackendKind;
    const backend = createBackend({
      kind,
      ollama: {
        baseUrl: env.KEV_OLLAMA_BASE_URL,
        model: env.KEV_OLLAMA_MODEL,
      },
      openai: {
        baseUrl: env.KEV_OPENAI_BASE_URL,
        apiKey: env.KEV_OPENAI_API_KEY || undefined,
        model: env.KEV_OPENAI_MODEL,
      },
    });

    const strategy: DecisionStrategy = env.KEV_STRATEGY;

    return evaluateSystemOne(request, {
      backend,
      modelName,
      strategy,
      cache,
      calibration: {
        name: env.KEV_CALIBRATION_PROFILE,
        readoutTemperature: env.KEV_READOUT_TEMPERATURE,
        noulTemperature: env.KEV_NOUL_TEMPERATURE,
      },
    });
  }

  async function batch(request: BatchRequest): Promise<BatchResponse> {
    const started = Date.now();
    const concurrency = request.concurrency ?? 8;
    const modelName = resolveModelName(env, request.model);
    const results: BatchResponse["results"] = new Array(request.items.length);
    let cursor = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    async function worker(): Promise<void> {
      for (;;) {
        const index = cursor++;
        if (index >= request.items.length) return;
        const item = request.items[index]!;
        try {
          const result = await systemOne({
            model: request.model,
            state: item.state,
            questions: item.questions,
            trace: item.trace,
          });
          inputTokens += result.usage.input_tokens;
          outputTokens += result.usage.output_tokens;
          results[index] = {
            id: item.id,
            index,
            ok: true,
            result,
          };
        } catch (err) {
          results[index] = {
            id: item.id,
            index,
            ok: false,
            error: {
              type: "item_error",
              message: err instanceof Error ? err.message : String(err),
              code: "evaluate_failed",
            },
          };
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, request.items.length) },
      () => worker(),
    );
    await Promise.all(workers);

    return {
      model: modelName,
      results,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: Date.now() - started,
      },
    };
  }

  return { systemOne, batch };
}
