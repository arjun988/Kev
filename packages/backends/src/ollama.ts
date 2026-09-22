import type {
  BackendCapabilities,
  ChatMessage,
  CompletionResult,
  InferenceBackend,
} from "@kev-ai/core";
import { clearTimeout, setTimeout } from "node:timers";
import { createAbortController, resolveFetch, type FetchFn } from "./fetch.js";
import { BackendError } from "./openai.js";

export type OllamaConfig = {
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: FetchFn;
};

type OllamaChatResponse = {
  message?: { content?: string; thinking?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

/**
 * Ollama backend (local models).
 * Ollama does not expose OpenAI-style top_logprobs on chat, so the engine
 * will auto-select constrained or parallel strategies.
 */
export class OllamaBackend implements InferenceBackend {
  readonly capabilities: BackendCapabilities = {
    name: "ollama",
    supportsLogprobs: false,
    supportsJsonMode: true,
  };

  private readonly baseUrl: string;
  private readonly fetchImpl: FetchFn;
  private readonly timeoutMs: number;
  private readonly model: string;

  constructor(config: OllamaConfig) {
    this.baseUrl = (config.baseUrl ?? "http://127.0.0.1:11434").replace(
      /\/+$/,
      "",
    );
    this.model = config.model;
    this.fetchImpl = resolveFetch(config.fetchImpl);
    this.timeoutMs = config.timeoutMs ?? 180_000;
  }

  async complete(args: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
    logprobs?: boolean;
    topLogprobs?: number;
    responseFormat?: "text" | "json";
  }): Promise<CompletionResult> {
    const url = `${this.baseUrl}/api/chat`;
    const body: Record<string, unknown> = {
      model: this.model,
      messages: args.messages,
      stream: false,
      // Qwen3 / thinking models otherwise spend the whole budget in `thinking`
      // and return empty `content`, which breaks constrained decode.
      think: false,
      options: {
        temperature: args.temperature,
        num_predict: args.maxTokens,
      },
    };

    if (args.responseFormat === "json") {
      body.format = "json";
    }

    const controller = createAbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      throw new BackendError(
        `ollama request failed (${this.baseUrl}): ${message}. Is Ollama running?`,
        "upstream_error",
      );
    } finally {
      clearTimeout(timer);
    }

    const data = (await response.json()) as OllamaChatResponse;

    if (!response.ok || data.error) {
      throw new BackendError(
        data.error ?? `HTTP ${response.status} from Ollama`,
        "upstream_error",
        response.status,
      );
    }

    const text =
      (data.message?.content ?? "").trim() ||
      extractJsonBlob(data.message?.thinking ?? "");

    return {
      text,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
    };
  }
}

function extractJsonBlob(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? text;
}
