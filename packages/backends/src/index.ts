import type { InferenceBackend } from "@kev-ai/core";
import { MockBackend } from "./mock.js";
import { OllamaBackend, type OllamaConfig } from "./ollama.js";
import {
  OpenAICompatibleBackend,
  type OpenAICompatibleConfig,
} from "./openai.js";

export type BackendKind = "mock" | "ollama" | "openai";

export type CreateBackendOptions = {
  kind: BackendKind;
  ollama?: OllamaConfig;
  openai?: OpenAICompatibleConfig;
};

export function createBackend(options: CreateBackendOptions): InferenceBackend {
  switch (options.kind) {
    case "mock":
      return new MockBackend();
    case "ollama": {
      if (!options.ollama?.model) {
        throw new Error("ollama backend requires ollama.model");
      }
      return new OllamaBackend(options.ollama);
    }
    case "openai": {
      if (!options.openai?.baseUrl || !options.openai?.model) {
        throw new Error("openai backend requires openai.baseUrl and openai.model");
      }
      return new OpenAICompatibleBackend(options.openai);
    }
    default: {
      const _exhaustive: never = options.kind;
      throw new Error(`unknown backend: ${_exhaustive}`);
    }
  }
}

export { MockBackend, evaluateWithMock } from "./mock.js";
export { OllamaBackend, type OllamaConfig } from "./ollama.js";
export {
  OpenAICompatibleBackend,
  BackendError,
  type OpenAICompatibleConfig,
} from "./openai.js";
export type { FetchFn, FetchInit, FetchResult } from "./fetch.js";
export { resolveFetch, createAbortController } from "./fetch.js";
