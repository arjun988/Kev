import { DecisionEngine } from "@kev-ai/core";
import { measureOptionOrderStability } from "@kev-ai/core";
import { MockBackend, evaluateWithMock } from "@kev-ai/backends";

/**
 * Run option-order stability against the mock evaluator path.
 * Uses DecisionEngine + MockBackend complete() which is weak for choices —
 * prefer evaluateWithMock-based shuffle for realistic mock scoring.
 */
export async function runStabilitySuite(trials = 20) {
  // Use evaluateWithMock via a tiny shim engine is awkward; instead shuffle
  // criteria and call evaluateWithMock directly.
  const state =
    "I was charged twice on my credit card invoice and want a refund now.";
  const baseCriteria = {
    billing: "charges and payments",
    bug: "product broken",
    account: "login problems",
  };
  const keys = Object.keys(baseCriteria);
  const choices: string[] = [];

  for (let t = 0; t < trials; t++) {
    const order = [...keys].sort(
      (a, b) => ((t + a.charCodeAt(0)) % 7) - ((t + b.charCodeAt(0)) % 7),
    );
    const criteria: Record<string, string | null> = {};
    for (const k of order) {
      criteria[k] = baseCriteria[k as keyof typeof baseCriteria];
    }
    const res = await evaluateWithMock({
      model: "kev-mock",
      state,
      questions: {
        topic: {
          type: "choice",
          instructions: "Topic?",
          criteria,
        },
      },
    });
    const ans = res.answers.topic;
    if (ans?.type === "choice") choices.push(ans.choice);
  }

  const counts = new Map<string, number>();
  for (const c of choices) counts.set(c, (counts.get(c) ?? 0) + 1);
  let majority = "";
  let majorityCount = 0;
  for (const [k, n] of counts) {
    if (n > majorityCount) {
      majority = k;
      majorityCount = n;
    }
  }
  const flipRate = 1 - majorityCount / trials;

  // Also exercise core helper with DecisionEngine for API completeness
  const engine = new DecisionEngine(new MockBackend(), {
    modelName: "kev-mock",
    strategy: "constrained",
  });
  const coreReport = await measureOptionOrderStability(
    engine,
    state,
    {
      type: "choice",
      instructions: "Topic?",
      criteria: baseCriteria,
    },
    Math.min(5, trials),
  );

  return {
    mockHeuristic: {
      trials,
      majorityChoice: majority,
      flipRate,
      uniqueChoices: [...counts.keys()],
    },
    engineConstrained: coreReport,
  };
}
