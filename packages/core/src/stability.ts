import type { ChoiceQuestion, State } from "@kev-ai/schema";
import type { DecisionEngine } from "./engine.js";

export type StabilityTrial = {
  order: string[];
  choice: string;
};

export type StabilityReport = {
  trials: number;
  uniqueChoices: string[];
  flipRate: number;
  majorityChoice: string;
  majorityShare: number;
  trialsDetail: StabilityTrial[];
};

function shuffleKeys(keys: string[], seed: number): string[] {
  const arr = [...keys];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Re-run a choice question with shuffled option orders.
 * flipRate = 1 - (majority count / trials). Target for production: &lt; 0.05.
 */
export async function measureOptionOrderStability(
  engine: DecisionEngine,
  state: State,
  question: ChoiceQuestion,
  trials = 20,
): Promise<StabilityReport> {
  const keys = Object.keys(question.criteria);
  if (keys.length < 2) {
    throw new Error("stability test needs at least 2 options");
  }

  const trialsDetail: StabilityTrial[] = [];
  const counts = new Map<string, number>();

  for (let t = 0; t < trials; t++) {
    const order = shuffleKeys(keys, 1000 + t * 97);
    const criteria: Record<string, string | null> = {};
    for (const k of order) {
      criteria[k] = question.criteria[k] ?? null;
    }
    const result = await engine.evaluateQuestion(state, {
      type: "choice",
      instructions: question.instructions,
      criteria,
    });
    if (result.answer.type !== "choice") {
      throw new Error("expected choice answer");
    }
    const choice = result.answer.choice;
    trialsDetail.push({ order, choice });
    counts.set(choice, (counts.get(choice) ?? 0) + 1);
  }

  let majorityChoice = keys[0]!;
  let majorityCount = 0;
  for (const [k, c] of counts) {
    if (c > majorityCount) {
      majorityCount = c;
      majorityChoice = k;
    }
  }

  return {
    trials,
    uniqueChoices: [...counts.keys()],
    flipRate: 1 - majorityCount / trials,
    majorityChoice,
    majorityShare: majorityCount / trials,
    trialsDetail,
  };
}
