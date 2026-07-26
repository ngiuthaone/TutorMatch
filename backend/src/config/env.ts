import { z } from "zod";

const positiveInteger = (name: string, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int(`${name} must be an integer`).positive(`${name} must be positive`).max(max);
const booleanString = z.enum(["true", "false"]).default("false").transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: positiveInteger("PORT", 65535).default(4000),
  FRONTEND_ORIGINS: z.string().transform((value, context) => {
    const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
    if (!origins.length || origins.some((origin) => origin === "*" || !z.string().url().safeParse(origin).success)) {
      context.addIssue({ code: "custom", message: "must be a comma-separated list of valid, non-wildcard origins" });
      return z.NEVER;
    }
    return origins.map((origin) => new URL(origin).origin);
  }),
  SUPABASE_URL: z.string().url("must be a valid URL"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "is required"),
  TRUST_PROXY: booleanString,
  RATE_LIMIT_MAX: positiveInteger("RATE_LIMIT_MAX").default(100),
  RATE_LIMIT_WINDOW_MS: positiveInteger("RATE_LIMIT_WINDOW_MS").default(60_000),
  ME_RATE_LIMIT_MAX: positiveInteger("ME_RATE_LIMIT_MAX").default(30),
  TUTOR_CV_GET_RATE_LIMIT_MAX: positiveInteger("TUTOR_CV_GET_RATE_LIMIT_MAX").default(60),
  TUTOR_CV_SAVE_RATE_LIMIT_MAX: positiveInteger("TUTOR_CV_SAVE_RATE_LIMIT_MAX").default(20),
  TUTOR_CV_PUBLISH_RATE_LIMIT_MAX: positiveInteger("TUTOR_CV_PUBLISH_RATE_LIMIT_MAX").default(10),
  PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX: positiveInteger("PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX").default(60),
  PUBLIC_TUTOR_DETAIL_RATE_LIMIT_MAX: positiveInteger("PUBLIC_TUTOR_DETAIL_RATE_LIMIT_MAX").default(120),
  REQUEST_TIMEOUT_MS: positiveInteger("REQUEST_TIMEOUT_MS", 300_000).default(15_000),
  KEEP_ALIVE_TIMEOUT_MS: positiveInteger("KEEP_ALIVE_TIMEOUT_MS", 300_000).default(5_000),
  BODY_LIMIT_BYTES: positiveInteger("BODY_LIMIT_BYTES", 10_485_760).default(16_384),
  MAX_AUTHORIZATION_HEADER_LENGTH: positiveInteger("MAX_AUTHORIZATION_HEADER_LENGTH", 65_536).default(8_192)
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "development") {
    for (const [field, url] of [["SUPABASE_URL", value.SUPABASE_URL], ...value.FRONTEND_ORIGINS.map((url) => ["FRONTEND_ORIGINS", url])] as const) {
      if (new URL(url).protocol !== "https:") context.addIssue({ code: "custom", path: [field], message: "must use HTTPS outside development" });
    }
  }
});

export type AppConfig = z.infer<typeof schema>;
export function parseEnvironment(source: NodeJS.ProcessEnv): AppConfig {
  const result = schema.safeParse(source);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`).join("; ");
    throw new Error(`Invalid backend environment: ${message}`);
  }
  return result.data;
}
