import type {
  BackendCapabilities,
  ChatMessage,
  CompletionResult,
  InferenceBackend,
  LogprobToken,
} from "@kev-ai/core";
import { clearTimeout, setTimeout } from "node:timers";
import { createAbortController, resolveFetch, type FetchFn } from "./fetch.js";

export type OpenAICompatibleConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** Override capability detection */
  supportsLogprobs?: boolean;
  supportsJsonMode?: boolean;
  timeoutMs?: number;
  fetchImpl?: FetchFn;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: { content?: string | null };
    text?: string;
    logprobs?: {
      content?: Array<{
        token?: string;
        logprob?: number;
        top_logprobs?: Array<{ token: string; logprob: number }>;
      }> | null;
      top_logprobs?: Array<Record<string, number>> | null;
    } | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string; type?: string };
};

/**
 * OpenAI-compatible chat completions backend (OpenAI, vLLM, Together, Groq, etc.).
 * Prefers logprobs when the provider returns them.
 */
export class OpenAICompatibleBackend implements InferenceBackend {
  readonly capabilities: BackendCapabilities;
  private readonly fetchImpl: FetchFn;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.fetchImpl = resolveFetch(config.fetchImpl);
    this.timeoutMs = config.timeoutMs ?? 120_000;
    const gemini = isGeminiBaseUrl(config.baseUrl);
    this.capabilities = {
      name: gemini ? "gemini-openai-compatible" : "openai-compatible",
      // Gemini's OpenAI-compat endpoint does not expose letter logprobs reliably
      supportsLogprobs: config.supportsLogprobs ?? !gemini,
      supportsJsonMode: config.supportsJsonMode ?? true,
    };
  }

  async complete(args: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
    logprobs?: boolean;
    topLogprobs?: number;
    responseFormat?: "text" | "json";
  }): Promise<CompletionResult> {
    const url = `${trimSlash(this.config.baseUrl)}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: args.messages,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
    };

    if (args.logprobs && this.capabilities.supportsLogprobs) {
      body.logprobs = true;
      body.top_logprobs = args.topLogprobs ?? 20;
    }

    if (args.responseFormat === "json" && this.capabilities.supportsJsonMode) {
      body.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const controller = createAbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      throw new BackendError(
        `openai-compatible request failed: ${message}`,
        "upstream_error",
      );
    } finally {
      clearTimeout(timer);
    }

    const data = (await response.json()) as OpenAIChatResponse;

    if (!response.ok) {
      const msg = data.error?.message ?? `HTTP ${response.status} from ${url}`;
      if (response.status === 400 && /logprob/i.test(msg) && args.logprobs) {
        throw new BackendError(msg, "logprobs_unsupported");
      }
      throw new BackendError(msg, "upstream_error", response.status);
    }

    const choice = data.choices?.[0];
    const text = choice?.message?.content ?? choice?.text ?? "";
    const topLogprobs = extractTopLogprobs(choice?.logprobs ?? null);

    return {
      text: text ?? "",
      topLogprobs,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}

function extractTopLogprobs(
  logprobs: {
    content?: Array<{
      top_logprobs?: Array<{ token: string; logprob: number }>;
    }> | null;
    top_logprobs?: Array<Record<string, number>> | null;
  } | null,
): LogprobToken[] | undefined {
  if (!logprobs) return undefined;

  const content = logprobs.content;
  if (content && content.length > 0) {
    const top = content[0]?.top_logprobs;
    if (top && top.length > 0) {
      return top.map((t) => ({ token: t.token, logprob: t.logprob }));
    }
  }

  const legacy = logprobs.top_logprobs;
  if (legacy && legacy[0]) {
    return Object.entries(legacy[0]).map(([token, logprob]) => ({
      token,
      logprob,
    }));
  }

  return undefined;
}

function isGeminiBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("generativelanguage.googleapis.com") ||
      host.includes("ai.google.dev")
    );
  } catch {
    return /generativelanguage\.googleapis\.com|ai\.google\.dev/i.test(url);
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export class BackendError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BackendError";
  }
}
