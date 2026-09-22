import {
  formatState,
  optionLetters,
  READOUT_LETTERS,
  type State,
} from "@kev-ai/schema";
import type {
  ChoiceQuestion,
  NoulQuestion,
  ScoreQuestion,
} from "@kev-ai/schema";

export type PromptOption = {
  letter: string;
  key: string;
  description: string | null;
};

/**
 * Labels for prompts. Readout uses A–Z/a–z (≤52). Constrained/parallel may
 * exceed that with numeric labels up to the schema max (255).
 */
export function optionLabels(
  count: number,
  mode: "readout" | "any" = "any",
): string[] {
  if (mode === "readout" || count <= READOUT_LETTERS.length) {
    return optionLetters(count);
  }
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

export function choiceOptions(
  question: ChoiceQuestion,
  mode: "readout" | "any" = "any",
): PromptOption[] {
  const keys = Object.keys(question.criteria);
  const letters = optionLabels(keys.length, mode);
  return keys.map((key, i) => ({
    letter: letters[i]!,
    key,
    description: question.criteria[key] ?? null,
  }));
}

export function scoreOptions(
  question: ScoreQuestion,
  mode: "readout" | "any" = "any",
): PromptOption[] {
  const letters = optionLabels(question.criteria.length, mode);
  return question.criteria.map((description, i) => ({
    letter: letters[i]!,
    key: String(i),
    description,
  }));
}

function renderOptions(options: PromptOption[]): string {
  return options
    .map((o) => {
      const desc = o.description ? ` — ${o.description}` : "";
      return `${o.letter}. ${o.key}${desc}`;
    })
    .join("\n");
}

/**
 * Builds a readout prompt: model should answer with a single option letter.
 * Used with max_tokens=1 + logprobs over the letter vocabulary.
 */
export function buildReadoutPrompt(args: {
  state: State;
  instructions: string;
  options: PromptOption[];
  kind: "choice" | "score" | "noul";
}): { system: string; user: string } {
  const stateText = formatState(args.state);
  const system = [
    "You are Kev, a System One decision model.",
    "Answer with exactly one letter corresponding to the best option.",
    "Do not explain. Do not write anything except the single letter.",
  ].join(" ");

  let questionBlock: string;
  if (args.kind === "noul") {
    questionBlock = [
      `Question (yes/no): ${args.instructions}`,
      "Options:",
      renderOptions(args.options),
    ].join("\n");
  } else {
    questionBlock = [
      `Question: ${args.instructions}`,
      "Options:",
      renderOptions(args.options),
    ].join("\n");
  }

  const user = [
    "State:",
    stateText,
    "",
    questionBlock,
    "",
    "Answer (single letter):",
  ].join("\n");

  return { system, user };
}

export function noulOptions(question: NoulQuestion): PromptOption[] {
  return [
    {
      letter: "A",
      key: "true",
      description: question.criteria?.true ?? "yes / true",
    },
    {
      letter: "B",
      key: "false",
      description: question.criteria?.false ?? "no / false",
    },
  ];
}

/**
 * Prompt for parallel micro-scoring: model returns a probability JSON.
 */
export function buildMicroScorePrompt(args: {
  state: State;
  instructions: string;
  optionKey: string;
  optionDescription: string | null;
}): { system: string; user: string } {
  const system =
    'You score how well an option fits. Reply with JSON only: {"p": <number between 0 and 1>}. No other text.';
  const desc = args.optionDescription
    ? `${args.optionKey}: ${args.optionDescription}`
    : args.optionKey;
  const user = [
    "State:",
    formatState(args.state),
    "",
    `Question: ${args.instructions}`,
    `Option to score: ${desc}`,
    "",
    'How well does this option fit? JSON: {"p": 0.0-1.0}',
  ].join("\n");
  return { system, user };
}

/**
 * Constrained JSON prompt when logprobs are unavailable.
 */
export function buildConstrainedPrompt(args: {
  state: State;
  instructions: string;
  options: PromptOption[];
  kind: "choice" | "score" | "noul";
}): { system: string; user: string } {
  const keys = args.options.map((o) => o.key);
  const system = [
    "You are Kev, a System One decision model.",
    "Reply with JSON only. No markdown.",
    `Schema: {"choice": "<one of: ${keys.join(" | ")}>", "confidence": <0-1>}`,
  ].join(" ");
  const user = [
    "State:",
    formatState(args.state),
    "",
    `Question: ${args.instructions}`,
    "Options:",
    renderOptions(args.options),
    "",
    "JSON answer:",
  ].join("\n");
  return { system, user };
}
