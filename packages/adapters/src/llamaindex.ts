import {
  KevClient,
  type KevClientOptions,
  type SystemOneRequest,
  type SystemOneResponse,
} from "@kev-ai/sdk";

/**
 * LlamaIndex-friendly function tool wrapper around Kev.
 */
export class KevLlamaTool {
  private readonly client: KevClient;

  constructor(options: KevClientOptions = {}) {
    this.client = new KevClient(options);
  }

  async call(
    input: Omit<SystemOneRequest, "model"> & { model?: string },
  ): Promise<SystemOneResponse> {
    return this.client.systemOne(input);
  }

  metadata() {
    return {
      name: "kev_systemone",
      description:
        "Evaluate System One questions with calibrated probabilities via Kev.",
    };
  }
}

export function createLlamaIndexKevTool(options: KevClientOptions = {}) {
  const tool = new KevLlamaTool(options);
  return {
    ...tool.metadata(),
    call: (input: Omit<SystemOneRequest, "model"> & { model?: string }) =>
      tool.call(input),
  };
}
