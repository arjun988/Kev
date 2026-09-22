import { clearTimeout, setTimeout } from "node:timers";
import {
  BatchRequestSchema,
  BatchResponseSchema,
  SystemOneRequestSchema,
  SystemOneResponseSchema,
  type BatchRequest,
  type BatchResponse,
  type ChoiceQuestion,
  type NoulQuestion,
  type ScoreQuestion,
  type State,
  type SystemOneRequest,
  type SystemOneResponse,
} from "@kev-ai/schema";

type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

function resolveFetch(fetchImpl?: FetchFn): FetchFn {
  if (fetchImpl) return fetchImpl;
  const g = globalThis as typeof globalThis & { fetch?: FetchFn };
  if (typeof g.fetch === "function") return g.fetch.bind(g);
  throw new Error("global fetch is not available; pass fetchImpl");
}

export type KevClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: FetchFn;
};

export class KevError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "KevError";
  }
}

export class KevClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchFn;

  constructor(options: KevClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.KEV_BASE_URL ??
      process.env.TYPESAFE_BASE_URL ??
      "http://127.0.0.1:3000"
    ).replace(/\/+$/, "");
    this.apiKey =
      options.apiKey ??
      process.env.KEV_API_KEY ??
      process.env.TYPESAFE_API_KEY;
    this.model = options.model ?? process.env.KEV_MODEL ?? "kev-latest";
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = resolveFetch(options.fetchImpl);
  }

  async health(): Promise<{
    status: string;
    version: string;
    backend: string;
    model: string;
  }> {
    const res = await this.request("GET", "/health");
    return res as {
      status: string;
      version: string;
      backend: string;
      model: string;
    };
  }

  async systemOne(
    input: Omit<SystemOneRequest, "model"> & { model?: string },
  ): Promise<SystemOneResponse> {
    const payload = SystemOneRequestSchema.parse({
      model: input.model ?? this.model,
      state: input.state,
      questions: input.questions,
      trace: input.trace,
      no_cache: input.no_cache,
    });
    const raw = await this.request("POST", "/v1/systemone", payload);
    return SystemOneResponseSchema.parse(raw);
  }

  async batch(
    input: Omit<BatchRequest, "model"> & { model?: string },
  ): Promise<BatchResponse> {
    const payload = BatchRequestSchema.parse({
      model: input.model ?? this.model,
      items: input.items,
      concurrency: input.concurrency,
    });
    const raw = await this.request("POST", "/v1/systemone/batch", payload);
    return BatchResponseSchema.parse(raw);
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          data = { raw: text };
        }
      }

      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: { message?: string } }).error?.message ===
            "string"
            ? (data as { error: { message: string } }).error.message
            : `HTTP ${res.status}`;
        throw new KevError(msg, res.status, data);
      }

      return data;
    } catch (err) {
      if (err instanceof KevError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new KevError(`Kev request failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function Choice(
  instructions: string,
  criteria: Record<string, string | null>,
): ChoiceQuestion {
  return { type: "choice", instructions, criteria };
}

export function Score(instructions: string, criteria: string[]): ScoreQuestion {
  return { type: "score", instructions, criteria };
}

export function Noul(
  instructions: string,
  criteria?: { true?: string; false?: string },
): NoulQuestion {
  return { type: "noul", instructions, ...(criteria ? { criteria } : {}) };
}

export type {
  BatchRequest,
  BatchResponse,
  ChoiceQuestion,
  NoulQuestion,
  ScoreQuestion,
  State,
  SystemOneRequest,
  SystemOneResponse,
};

export {
  BatchRequestSchema,
  BatchResponseSchema,
  SystemOneRequestSchema,
  SystemOneResponseSchema,
};
