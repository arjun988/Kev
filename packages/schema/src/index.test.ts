import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SystemOneRequestSchema,
  SystemOneResponseSchema,
  formatState,
  optionLetters,
} from "./index.js";

describe("SystemOneRequestSchema", () => {
  it("accepts a valid multi-question request", () => {
    const parsed = SystemOneRequestSchema.parse({
      state: "Customer charged twice",
      questions: {
        topic: {
          type: "choice",
          instructions: "Topic?",
          criteria: { billing: "money", bug: "broken" },
        },
        escalate: {
          type: "noul",
          instructions: "Escalate?",
        },
        severity: {
          type: "score",
          instructions: "Urgency?",
          criteria: ["low", "medium", "high"],
        },
      },
    });
    assert.equal(parsed.model, "kev-latest");
    assert.equal(Object.keys(parsed.questions).length, 3);
  });

  it("rejects empty questions", () => {
    assert.throws(() =>
      SystemOneRequestSchema.parse({ state: "x", questions: {} }),
    );
  });
});

describe("SystemOneResponseSchema", () => {
  it("accepts a full response shape", () => {
    const parsed = SystemOneResponseSchema.parse({
      model: "kev-0.1.0",
      answers: {
        topic: {
          type: "choice",
          choice: "billing",
          confidence: 0.9,
          probabilities: { billing: 0.9, bug: 0.1 },
        },
        escalate: { type: "noul", noul: 0.8 },
      },
      usage: { input_tokens: 10, output_tokens: 0, latency_ms: 12 },
    });
    assert.equal(parsed.answers.topic?.type, "choice");
  });
});

describe("helpers", () => {
  it("formats object state as JSON", () => {
    assert.match(formatState({ a: 1 }), /"a": 1/);
  });

  it("maps option letters", () => {
    assert.deepEqual(optionLetters(3), ["A", "B", "C"]);
  });
});
