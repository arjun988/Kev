import { z } from "zod";

/** String, object, or array of strings — anything software can hand a decision model. */
export const StateSchema = z.union([
  z.string(),
  z.record(z.unknown()),
  z.array(z.union([z.string(), z.record(z.unknown())])),
]);
export type State = z.infer<typeof StateSchema>;

export const ChoiceQuestionSchema = z.object({
  type: z.literal("choice"),
  instructions: z.string().min(1),
  criteria: z
    .record(z.string().nullable())
    .refine((c) => Object.keys(c).length >= 1 && Object.keys(c).length <= 255, {
      message: "choice criteria must have between 1 and 255 options",
    }),
});
export type ChoiceQuestion = z.infer<typeof ChoiceQuestionSchema>;

export const ScoreQuestionSchema = z.object({
  type: z.literal("score"),
  instructions: z.string().min(1),
  criteria: z
    .array(z.string().min(1))
    .min(2)
    .max(10),
});
export type ScoreQuestion = z.infer<typeof ScoreQuestionSchema>;

export const NoulQuestionSchema = z.object({
  type: z.literal("noul"),
  instructions: z.string().min(1),
  criteria: z
    .object({
      true: z.string().optional(),
      false: z.string().optional(),
    })
    .optional(),
});
export type NoulQuestion = z.infer<typeof NoulQuestionSchema>;

export const QuestionSchema = z.discriminatedUnion("type", [
  ChoiceQuestionSchema,
  ScoreQuestionSchema,
  NoulQuestionSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;

export const SystemOneRequestSchema = z.object({
  model: z.string().min(1).optional().default("kev-latest"),
  state: StateSchema,
  questions: z
    .record(QuestionSchema)
    .refine((q) => Object.keys(q).length >= 1, {
      message: "at least one question is required",
    }),
  /** Kev extension: include engine/backend trace in the response */
  trace: z.boolean().optional(),
});
export type SystemOneRequest = z.infer<typeof SystemOneRequestSchema>;

export const ChoiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.number()),
});
export type ChoiceAnswer = z.infer<typeof ChoiceAnswerSchema>;

export const ScoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  confidence: z.number().min(0).max(1),
  legend: z.record(z.string()),
  probabilities: z.record(z.number()),
});
export type ScoreAnswer = z.infer<typeof ScoreAnswerSchema>;

export const NoulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: z.number().min(0).max(1),
});
export type NoulAnswer = z.infer<typeof NoulAnswerSchema>;

export const AnswerSchema = z.discriminatedUnion("type", [
  ChoiceAnswerSchema,
  ScoreAnswerSchema,
  NoulAnswerSchema,
]);
export type Answer = z.infer<typeof AnswerSchema>;

export const UsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  latency_ms: z.number().nonnegative().optional(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const QuestionTraceSchema = z.object({
  strategy: z.enum(["readout", "constrained", "parallel", "mock"]),
  backend: z.string(),
  option_keys: z.array(z.string()).optional(),
  raw_scores: z.record(z.number()).optional(),
});
export type QuestionTrace = z.infer<typeof QuestionTraceSchema>;

export const SystemOneResponseSchema = z.object({
  model: z.string(),
  answers: z.record(AnswerSchema),
  usage: UsageSchema,
  trace: z.record(QuestionTraceSchema).optional(),
});
export type SystemOneResponse = z.infer<typeof SystemOneResponseSchema>;

export const ErrorBodySchema = z.object({
  error: z.object({
    type: z.string(),
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

/** Serialize state into a stable prompt string. */
export function formatState(state: State): string {
  if (typeof state === "string") return state;
  return JSON.stringify(state, null, 2);
}

/** Letter labels for readout: A–Z then a–z (52 options per pass). */
export const READOUT_LETTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");

export function optionLetters(count: number): string[] {
  if (count > READOUT_LETTERS.length) {
    throw new Error(
      `readout supports at most ${READOUT_LETTERS.length} options per pass; got ${count}`,
    );
  }
  return READOUT_LETTERS.slice(0, count);
}

export { openApiDocument } from "./openapi.js";
