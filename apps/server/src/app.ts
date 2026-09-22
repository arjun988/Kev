import { BackendError } from "@kev-ai/backends";
import {
  BatchRequestSchema,
  SystemOneRequestSchema,
  openApiDocument,
} from "@kev-ai/schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createAuditLog } from "./audit.js";
import type { ServerEnv } from "./config.js";
import { createDecisionService, resolveModelName } from "./decision.js";
import type { Logger } from "./logger.js";
import { RateLimiter } from "./rate-limit.js";
import { createTelemetry } from "./telemetry.js";

export const VERSION = "0.2.0";

export type AppDeps = {
  env: ServerEnv;
  logger: Logger;
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export function createApp(deps: AppDeps): Hono {
  const { env, logger } = deps;
  const app = new Hono();
  const decisions = createDecisionService(env);
  const audit = createAuditLog(logger, env.KEV_AUDIT);
  const telemetry = createTelemetry(env.KEV_OTEL, (line) =>
    logger.info("otel", line as Record<string, unknown>),
  );
  const limiter = new RateLimiter(env.KEV_RATE_LIMIT, env.KEV_RATE_WINDOW_MS);

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

  app.use("/v1/*", async (c, next) => {
    const key =
      c.req.header("authorization") ??
      c.req.header("x-forwarded-for") ??
      c.req.header("x-real-ip") ??
      "anon";
    const check = limiter.check(key);
    if (!check.ok) {
      c.header("Retry-After", String(check.retryAfterSec));
      return c.json(
        {
          error: {
            type: "rate_limit_error",
            message: "Rate limit exceeded",
            code: "rate_limited",
          },
        },
        429,
      );
    }
    await next();
  });

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
      cache_size: env.KEV_CACHE_SIZE,
      rate_limit: env.KEV_RATE_LIMIT,
    }),
  );

  app.get("/", (c) =>
    c.json({
      name: "Kev",
      version: VERSION,
      description: "Open-source System One decision engine",
      docs: "/openapi.json",
      playground: "/playground/",
      endpoints: {
        health: "GET /health",
        systemone: "POST /v1/systemone",
        batch: "POST /v1/systemone/batch",
        openapi: "GET /openapi.json",
      },
    }),
  );

  app.get("/openapi.json", (c) => c.json(openApiDocument));

  // Playground static files
  const playgroundDir = resolvePlaygroundDir(env.KEV_PLAYGROUND_DIR);
  if (playgroundDir) {
    app.get("/playground", (c) => c.redirect("/playground/"));
    app.get("/playground/", async (c) => {
      const res = readPlaygroundFile(playgroundDir, "index.html");
      return res ?? c.text("Playground not found", 404);
    });
    app.get("/playground/*", async (c) => {
      const rel = c.req.path.replace(/^\/playground\/?/, "") || "index.html";
      const res = readPlaygroundFile(playgroundDir, rel);
      return res ?? c.text("Not found", 404);
    });
  }

  app.post("/v1/systemone", async (c) => {
    const span = telemetry.startSpan("systemone");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      span.end({ status: 400 });
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
      span.end({ status: 400 });
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

    try {
      const response = await decisions.systemOne(parsed.data);
      audit.record({
        type: "systemone",
        model: response.model,
        backend: env.KEV_BACKEND,
        questions: Object.keys(parsed.data.questions).length,
        latency_ms: response.usage.latency_ms,
        cache_hit: response.usage.cache_hit,
      });
      span.end({
        status: 200,
        latency_ms: response.usage.latency_ms,
        cache_hit: response.usage.cache_hit,
      });
      return c.json(response);
    } catch (err) {
      span.setError(err);
      span.end({ status: 502 });
      return handleUpstream(c, err, logger, audit);
    }
  });

  app.post("/v1/systemone/batch", async (c) => {
    const span = telemetry.startSpan("systemone.batch");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      span.end({ status: 400 });
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

    const parsed = BatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      span.end({ status: 400 });
      return c.json(
        {
          error: {
            type: "invalid_request_error",
            message: "Invalid batch request",
            code: "validation_error",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }

    try {
      const response = await decisions.batch(parsed.data);
      audit.record({
        type: "batch",
        model: response.model,
        backend: env.KEV_BACKEND,
        items: response.results.length,
        latency_ms: response.usage.latency_ms,
      });
      span.end({
        status: 200,
        items: response.results.length,
        latency_ms: response.usage.latency_ms,
      });
      return c.json(response);
    } catch (err) {
      span.setError(err);
      span.end({ status: 502 });
      return handleUpstream(c, err, logger, audit);
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

function handleUpstream(
  c: { json: (body: unknown, status: 500 | 502) => Response },
  err: unknown,
  logger: Logger,
  audit: ReturnType<typeof createAuditLog>,
) {
  if (err instanceof BackendError) {
    logger.error("backend_error", {
      code: err.code,
      message: err.message,
      status: err.status,
    });
    audit.record({ type: "error", error: err.message });
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
  audit.record({ type: "error", error: message });
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

function resolvePlaygroundDir(configured: string): string | null {
  const candidates = [
    configured,
    resolve(process.cwd(), "../../apps/playground"),
    resolve(process.cwd(), "../playground"),
    resolve(process.cwd(), "apps/playground"),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (dir && existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

function readPlaygroundFile(root: string, rel: string): Response | null {
  const cleaned = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const full = resolve(root, cleaned);
  if (!full.startsWith(resolve(root))) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  const data = readFileSync(full);
  const type = MIME[extname(full)] ?? "application/octet-stream";
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": type },
  });
}

export { createDecisionService, resolveModelName } from "./decision.js";
