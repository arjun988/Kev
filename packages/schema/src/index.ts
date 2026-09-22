import { z } from "zod";

/** Multimodal image input for agent / screenshot decisions. */
export const ImagePartSchema = z.object({
  url: z.string().url().optional(),
  /** Raw base64 without data: prefix */
  b64: z.string().min(1).optional(),
  media_type: z
    .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
    .default("image/png"),
  detail: z.enum(["low", "high", "auto"]).optional(),
}).refine((v) => Boolean(v.url || v.b64), {
  message: "image part requires url or b64",
});
export type ImagePart = z.infer<typeof ImagePartSchema>;

/**
 * String, object, array, or multimodal payload.
 * Multimodal shape: { text?: string, images?: ImagePart[], ...any }
 */
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
  criteria: z.array(z.string().min(1)).min(2).max(10),
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
  /** Kev extension: bypass server-side response cache */
  no_cache: z.boolean().optional(),
});
export type SystemOneRequest = z.infer<typeof SystemOneRequestSchema>;

export const BatchRequestSchema = z.object({
  model: z.string().min(1).optional().default("kev-latest"),
  items: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        state: StateSchema,
        questions: z.record(QuestionSchema).refine((q) => Object.keys(q).length >= 1, {
          message: "at least one question is required",
        }),
        trace: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(100),
  /** Max concurrent item evaluations (server may lower this) */
  concurrency: z.number().int().min(1).max(32).optional().default(8),
});
export type BatchRequest = z.infer<typeof BatchRequestSchema>;

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
  cache_hit: z.boolean().optional(),
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

export const BatchItemResultSchema = z.object({
  id: z.string().optional(),
  index: z.number().int().nonnegative(),
  ok: z.boolean(),
  result: SystemOneResponseSchema.optional(),
  error: z
    .object({
      type: z.string(),
      message: z.string(),
      code: z.string().optional(),
    })
    .optional(),
});
export type BatchItemResult = z.infer<typeof BatchItemResultSchema>;

export const BatchResponseSchema = z.object({
  model: z.string(),
  results: z.array(BatchItemResultSchema),
  usage: UsageSchema,
});
export type BatchResponse = z.infer<typeof BatchResponseSchema>;

export const ErrorBodySchema = z.object({
  error: z.object({
    type: z.string(),
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

/** Extract image parts from a multimodal state object, if present. */
export function extractImages(state: State): ImagePart[] {
  if (!state || typeof state !== "object" || Array.isArray(state)) return [];
  const images = (state as { images?: unknown }).images;
  if (!Array.isArray(images)) return [];
  const out: ImagePart[] = [];
  for (const item of images) {
    const parsed = ImagePartSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Serialize state into a stable prompt string (images summarized, not inlined). */
export function formatState(state: State): string {
  if (typeof state === "string") return state;
  if (Array.isArray(state)) return JSON.stringify(state, null, 2);
  const images = extractImages(state);
  if (images.length === 0) return JSON.stringify(state, null, 2);
  const { images: _drop, ...rest } = state as Record<string, unknown>;
  const text =
    typeof rest.text === "string"
      ? rest.text
      : JSON.stringify(rest, null, 2);
  const imageNote = images
    .map((img, i) => {
      const src = img.url ?? `b64:${(img.b64 ?? "").slice(0, 16)}…`;
      return `[image ${i + 1}: ${img.media_type} ${src}]`;
    })
    .join("\n");
  return `${text}\n\nAttached images:\n${imageNote}`;
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
