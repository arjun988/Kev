import {
  KevClient,
  type KevClientOptions,
  type SystemOneRequest,
  type SystemOneResponse,
} from "@kev-ai/sdk";

/**
 * Thin LangChain-friendly classifier wrapper.
 * Does not hard-depend on @langchain/core — drop into RunnableLambda / tools.
 */
export class KevClassifier {
  private readonly client: KevClient;

  constructor(options: KevClientOptions = {}) {
    this.client = new KevClient(options);
  }

  async invoke(
    input: Omit<SystemOneRequest, "model"> & { model?: string },
  ): Promise<SystemOneResponse> {
    return this.client.systemOne(input);
  }

  /** Helper for LangChain tool schemas / RunnableLambda */
  asCallable() {
    return (input: Omit<SystemOneRequest, "model"> & { model?: string }) =>
      this.invoke(input);
  }
}

export function createLangChainKevTool(options: KevClientOptions = {}) {
  const classifier = new KevClassifier(options);
  return {
    name: "kev_systemone",
    description:
      "Make a typed System One decision (choice/score/noul) using Kev.",
    invoke: (input: Omit<SystemOneRequest, "model"> & { model?: string }) =>
      classifier.invoke(input),
  };
}
