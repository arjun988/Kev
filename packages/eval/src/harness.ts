import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateWithMock } from "@kev-ai/backends";
import type { SystemOneResponse } from "@kev-ai/schema";
import { KevClient } from "@kev-ai/sdk";

export type EvalExample = {
  id: string;
  state: string | Record<string, unknown>;
  questions: Record<string, unknown>;
  expected?: {
    /** For choice questions: map question name → expected key */
    choice?: Record<string, string>;
    /** For noul: map question name → { min?, max? } */
    noul?: Record<string, { min?: number; max?: number }>;
  };
};

export type EvalReport = {
  dataset: string;
  total: number;
  correct: number;
  accuracy: number;
  failures: Array<{ id: string; reason: string }>;
};

export function loadDataset(path: string): EvalExample[] {
  const raw = JSON.parse(readFileSync(resolve(path), "utf8")) as {
    examples: EvalExample[];
  };
  return raw.examples;
}

function scoreExample(
  example: EvalExample,
  response: SystemOneResponse,
): string | null {
  if (!example.expected) return null;
  if (example.expected.choice) {
    for (const [q, expected] of Object.entries(example.expected.choice)) {
      const ans = response.answers[q];
      if (!ans || ans.type !== "choice") {
        return `${q}: missing choice answer`;
      }
      if (ans.choice !== expected) {
        return `${q}: got ${ans.choice}, expected ${expected}`;
      }
    }
  }
  if (example.expected.noul) {
    for (const [q, band] of Object.entries(example.expected.noul)) {
      const ans = response.answers[q];
      if (!ans || ans.type !== "noul") {
        return `${q}: missing noul answer`;
      }
      if (band.min !== undefined && ans.noul < band.min) {
        return `${q}: noul ${ans.noul} < min ${band.min}`;
      }
      if (band.max !== undefined && ans.noul > band.max) {
        return `${q}: noul ${ans.noul} > max ${band.max}`;
      }
    }
  }
  return null;
}

export async function runDataset(options: {
  path: string;
  mode: "mock" | "api";
  baseUrl?: string;
  apiKey?: string;
}): Promise<EvalReport> {
  const examples = loadDataset(options.path);
  const client =
    options.mode === "api"
      ? new KevClient({ baseUrl: options.baseUrl, apiKey: options.apiKey })
      : null;

  let correct = 0;
  const failures: EvalReport["failures"] = [];

  for (const example of examples) {
    const response = client
      ? await client.systemOne({
          state: example.state as never,
          questions: example.questions as never,
        })
      : await evaluateWithMock({
          model: "kev-mock",
          state: example.state as never,
          questions: example.questions as never,
        });

    const reason = scoreExample(example, response);
    if (reason) failures.push({ id: example.id, reason });
    else correct += 1;
  }

  return {
    dataset: options.path,
    total: examples.length,
    correct,
    accuracy: examples.length ? correct / examples.length : 0,
    failures,
  };
}
