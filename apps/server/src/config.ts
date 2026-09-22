import { z } from "zod";

const BackendKindSchema = z.enum(["mock", "ollama", "openai"]);

export const ServerEnvSchema = z.object({
  KEV_HOST: z.string().default("0.0.0.0"),
  KEV_PORT: z.coerce.number().int().positive().default(3000),
  KEV_MODEL: z.string().default("kev-latest"),
  KEV_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  KEV_BACKEND: BackendKindSchema.default("mock"),
  KEV_OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  KEV_OLLAMA_MODEL: z.string().default("llama3.2"),
  KEV_OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  KEV_OPENAI_API_KEY: z.string().optional().default(""),
  KEV_OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  KEV_READOUT_TEMPERATURE: z.coerce.number().positive().default(0.85),
  KEV_NOUL_TEMPERATURE: z.coerce.number().positive().default(1.0),
  KEV_CALIBRATION_PROFILE: z.string().default("default"),
  KEV_STRATEGY: z
    .enum(["auto", "readout", "constrained", "parallel", "mock"])
    .default("auto"),
  KEV_API_KEY: z.string().optional().default(""),
  /** Max requests per window per client (0 = disabled) */
  KEV_RATE_LIMIT: z.coerce.number().int().nonnegative().default(120),
  KEV_RATE_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** Response cache size (0 = disabled) */
  KEV_CACHE_SIZE: z.coerce.number().int().nonnegative().default(256),
  /** Emit audit JSONL lines */
  KEV_AUDIT: z
    .enum(["0", "1", "true", "false"])
    .default("1")
    .transform((v) => v === "1" || v === "true"),
  /** Emit OpenTelemetry-style span JSON */
  KEV_OTEL: z
    .enum(["0", "1", "true", "false"])
    .default("0")
    .transform((v) => v === "1" || v === "true"),
  /** Directory with playground static files (optional) */
  KEV_PLAYGROUND_DIR: z.string().optional().default(""),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  return ServerEnvSchema.parse(source);
}
