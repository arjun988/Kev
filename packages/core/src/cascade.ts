import type { ChoiceQuestion, State } from "@kev-ai/schema";
import type { DecisionEngine } from "./engine.js";

export type CascadeOptions = {
  /** Max options per leaf choice call (default 52 for readout, max 255) */
  chunkSize?: number;
  /** Instructions for intermediate coarse picks */
  coarseInstructions?: string;
};

export type CascadeResult = {
  choice: string;
  path: string[];
  confidence: number;
  probabilities: Record<string, number>;
};

/**
 * Hierarchical choice for taxonomies larger than 255 options.
 * Groups options into chunks, picks a winning group, then picks within the group.
 */
export async function cascadeChoice(
  engine: DecisionEngine,
  state: State,
  question: Omit<ChoiceQuestion, "type"> & { type?: "choice" },
  options: CascadeOptions = {},
): Promise<CascadeResult> {
  const chunkSize = Math.min(255, Math.max(2, options.chunkSize ?? 52));
  const entries = Object.entries(question.criteria);
  if (entries.length === 0) {
    throw new Error("cascadeChoice requires at least one criterion");
  }
  if (entries.length <= chunkSize) {
    const result = await engine.evaluateQuestion(state, {
      type: "choice",
      instructions: question.instructions,
      criteria: question.criteria,
    });
    if (result.answer.type !== "choice") {
      throw new Error("expected choice answer");
    }
    return {
      choice: result.answer.choice,
      path: [result.answer.choice],
      confidence: result.answer.confidence,
      probabilities: result.answer.probabilities,
    };
  }

  const groups: Array<{
    id: string;
    keys: string[];
    criteria: Record<string, string | null>;
  }> = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    const slice = entries.slice(i, i + chunkSize);
    const criteria: Record<string, string | null> = {};
    const keys: string[] = [];
    for (const [k, v] of slice) {
      criteria[k] = v;
      keys.push(k);
    }
    groups.push({ id: `group_${groups.length}`, keys, criteria });
  }

  const coarseCriteria: Record<string, string | null> = {};
  for (const g of groups) {
    coarseCriteria[g.id] = `Options: ${g.keys.slice(0, 8).join(", ")}${
      g.keys.length > 8 ? ", …" : ""
    }`;
  }

  const coarse = await engine.evaluateQuestion(state, {
    type: "choice",
    instructions:
      options.coarseInstructions ??
      `${question.instructions} (pick the option group that best fits)`,
    criteria: coarseCriteria,
  });
  if (coarse.answer.type !== "choice") {
    throw new Error("expected choice answer from coarse cascade");
  }
  const coarseChoice = coarse.answer.choice;
  const coarseConfidence = coarse.answer.confidence;

  const group = groups.find((g) => g.id === coarseChoice) ?? groups[0]!;
  const fine = await cascadeChoice(
    engine,
    state,
    {
      type: "choice",
      instructions: question.instructions,
      criteria: group.criteria,
    },
    options,
  );

  return {
    choice: fine.choice,
    path: [coarseChoice, ...fine.path],
    confidence: Math.min(coarseConfidence, fine.confidence),
    probabilities: fine.probabilities,
  };
}
