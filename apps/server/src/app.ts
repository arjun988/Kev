import {
  createBackend,
  evaluateWithMock,
  BackendError,
  type BackendKind,
} from "@kev-ai/backends";
import { evaluateSystemOne, type DecisionStrategy } from "@kev-ai/core";
import {
  SystemOneRequestSchema,
  openApiDocument,
  type SystemOneResponse,
} from "@kev-ai/schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { ServerEnv } from "./config.js";
import type { Logger } from "./logger.js";

export const VERSION = "0.1.0";

export type AppDeps = {
  env: ServerEnv;
  logger: Logger;
};

function resolveModelName(env: ServerEnv, requested?: string): string {
  if (requested && requested !== "kev-latest" && requested !== "jev-latest") {
    return requested;
  }
  if (env.KEV_BACKEND === "mock") return "kev-mock";
  if (env.KEV_BACKEND === "ollama") return `kev-ollama/${env.KEV_OLLAMA_MODEL}`;
  return `kev-openai/${env.KEV_OPENAI_MODEL}`;
}

export function createApp(deps: AppDeps): Hono {
  const { env, logger } = deps;
  const app = new Hono();

  app.use("*", cors());

  app.use("*", async (c, next) => {
    const started = Date.now();
    await next();
    logger.debug("request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Date.now() - started,
    });
  });

  // Optional bearer auth when KEV_API_KEY is set
  app.use("/v1/*", async (c, next) => {
    if (!env.KEV_API_KEY) {
      await next();
      return;
    }
    const header = c.req.header("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match || match[1] !== env.KEV_API_KEY) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    await next();
  });

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      version: VERSION,
      backend: env.KEV_BACKEND,
      model: resolveModelName(env),
    }),
  );

  app.get("/", (c) =>
    c.json({
      name: "Kev",
      version: VERSION,
      description: "Open-source System One decision engine",
      docs: "/openapi.json",
      endpoints: {
        health: "GET /health",
        systemone: "POST /v1/systemone",
        openapi: "GET /openapi.json",
      },
    }),
  );

  app.get("/openapi.json", (c) => c.json(openApiDocument));

  app.post("/v1/systemone", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Request body must be valid JSON",
            code: "invalid_json",
          },
        },
        400,
      );
    }

    const parsed = SystemOneRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Invalid System One request",
            code: "validation_error",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }

    const request = parsed.data;
    const modelName = resolveModelName(env, request.model);

    try {
      const response = await runSystemOne(env, request, modelName);
      logger.info("systemone", {
        model: response.model,
        questions: Object.keys(request.questions).length,
        latency_ms: response.usage.latency_ms,
        backend: env.KEV_BACKEND,
      });
      return c.json(response);
    } catch (err) {
      if (err instanceof BackendError) {
        logger.error("backend_error", {
          code: err.code,
          message: err.message,
          status: err.status,
        });
        return c.json(
          {
            error: {
              type: "upstream_error",
              message: err.message,
              code: err.code,
            },
          },
          502,
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error("internal_error", { message });
      return c.json(
        {
          error: {
            type: "server_error",
            message,
            code: "internal_error",
          },
        },
        500,
      );
    }
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json(
        {
          error: {
            type: "http_error",
            message: err.message,
            code: String(err.status),
          },
        },
        err.status,
      );
    }
    logger.error("unhandled", {
      message: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      {
        error: {
          type: "server_error",
          message: "Internal server error",
          code: "internal_error",
        },
      },
      500,
    );
  });

  return app;
}

async function runSystemOne(
  env: ServerEnv,
  request: ReturnType<typeof SystemOneRequestSchema.parse>,
  modelName: string,
): Promise<SystemOneResponse> {
  if (env.KEV_BACKEND === "mock" || env.KEV_STRATEGY === "mock") {
    return evaluateWithMock(request, modelName);
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

  // mock strategy already returned above; remaining values are engine strategies
  const strategy: DecisionStrategy = env.KEV_STRATEGY;

  return evaluateSystemOne(request, {
    backend,
    modelName,
    strategy,
    calibration: {
      name: env.KEV_CALIBRATION_PROFILE,
      readoutTemperature: env.KEV_READOUT_TEMPERATURE,
      noulTemperature: env.KEV_NOUL_TEMPERATURE,
    },
  });
}
