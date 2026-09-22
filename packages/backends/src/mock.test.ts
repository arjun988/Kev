import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateWithMock } from "./mock.js";

describe("evaluateWithMock", () => {
  it("routes billing tickets", async () => {
    const res = await evaluateWithMock({
      model: "kev-mock",
      state: "I was charged twice on my credit card invoice",
      questions: {
        topic: {
          type: "choice",
          instructions: "Topic?",
          criteria: {
            billing: "charges and payments",
            bug: "product broken",
            account: "login",
          },
        },
        escalate: {
          type: "noul",
          instructions: "Escalate?",
        },
      },
    });
    assert.equal(res.answers.topic?.type, "choice");
    if (res.answers.topic?.type === "choice") {
      assert.equal(res.answers.topic.choice, "billing");
    }
    assert.equal(res.answers.escalate?.type, "noul");
  });
});
