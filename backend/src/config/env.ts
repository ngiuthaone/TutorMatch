import { z } from "zod";

const positiveInteger = (name: string, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int(`${name} must be an integer`).positive(`${name} must be positive`).max(max);
const booleanString = z.enum(["true", "false"]).default("false").transform((value) => value === "true");
const logLevel = z.enum(["debug", "info", "warn", "error"]).default("info");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TUTORIA_ENVIRONMENT: z.enum(["development", "test", "staging", "production"]).default("development"),
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
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ALLOWED_IMAGE_HOSTS: z.string().transform((value, context) => {
    const hosts = value.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
    for (const host of hosts) {
      if (host.includes("/") || host.includes(":") || host.includes("*")) {
        context.addIssue({ code: "custom", message: "ALLOWED_IMAGE_HOSTS must be comma-separated hostnames (no paths, ports, or wildcards)" });
        return z.NEVER;
      }
    }
    return hosts;
  }).optional(),
  VNPAY_TMN_CODE: z.string().trim().min(1).optional(),
  VNPAY_HASH_SECRET: z.string().min(1).optional(),
  VNPAY_PAYMENT_URL: z.string().url().default("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),
  VNPAY_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  VNPAY_RETURN_URL: z.string().url().optional(),
  VNPAY_IPN_URL: z.string().url().optional(),
  VNPAY_API_URL: z.string().url().default("https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"),
  VNPAY_REQUEST_TIMEOUT_MS: positiveInteger("VNPAY_REQUEST_TIMEOUT_MS", 55_000).default(15_000),
  PAYMENT_RECONCILIATION_TOKEN: z.string().min(16).optional(),
  TRUST_PROXY: booleanString,
  RATE_LIMIT_MAX: positiveInteger("RATE_LIMIT_MAX").default(100),
  RATE_LIMIT_WINDOW_MS: positiveInteger("RATE_LIMIT_WINDOW_MS").default(60_000),
  ME_RATE_LIMIT_MAX: positiveInteger("ME_RATE_LIMIT_MAX").default(30),
  TUTOR_CV_GET_RATE_LIMIT_MAX: positiveInteger("TUTOR_CV_GET_RATE_LIMIT_MAX").default(60),
  TUTOR_CV_SAVE_RATE_LIMIT_MAX: positiveInteger("TUTOR_CV_SAVE_RATE_LIMIT_MAX").default(20),
  TUTOR_CV_PUBLISH_RATE_LIMIT_MAX: positiveInteger("TUTOR_CV_PUBLISH_RATE_LIMIT_MAX").default(10),
  EVENT_PUBLISH_RATE_LIMIT_MAX: positiveInteger("EVENT_PUBLISH_RATE_LIMIT_MAX").default(10),
  EVENT_READ_RATE_LIMIT_MAX: positiveInteger("EVENT_READ_RATE_LIMIT_MAX").default(120),
  COURSE_PUBLISH_RATE_LIMIT_MAX: positiveInteger("COURSE_PUBLISH_RATE_LIMIT_MAX").default(10),
  COURSE_READ_RATE_LIMIT_MAX: positiveInteger("COURSE_READ_RATE_LIMIT_MAX").default(120),
  THREAD_PUBLISH_RATE_LIMIT_MAX: positiveInteger("THREAD_PUBLISH_RATE_LIMIT_MAX").default(10),
  THREAD_READ_RATE_LIMIT_MAX: positiveInteger("THREAD_READ_RATE_LIMIT_MAX").default(60),
  ARTICLE_PUBLISH_RATE_LIMIT_MAX: positiveInteger("ARTICLE_PUBLISH_RATE_LIMIT_MAX").default(20),
  ARTICLE_READ_RATE_LIMIT_MAX: positiveInteger("ARTICLE_READ_RATE_LIMIT_MAX").default(60),
  COMMENT_RATE_LIMIT_MAX: positiveInteger("COMMENT_RATE_LIMIT_MAX").default(30),
  PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX: positiveInteger("PUBLIC_TUTORS_LIST_RATE_LIMIT_MAX").default(60),
  PUBLIC_TUTOR_DETAIL_RATE_LIMIT_MAX: positiveInteger("PUBLIC_TUTOR_DETAIL_RATE_LIMIT_MAX").default(120),
  MESSAGING_READ_RATE_LIMIT_MAX: positiveInteger("MESSAGING_READ_RATE_LIMIT_MAX").default(120),
  MESSAGING_SEND_RATE_LIMIT_MAX: positiveInteger("MESSAGING_SEND_RATE_LIMIT_MAX").default(30),
  REQUEST_TIMEOUT_MS: positiveInteger("REQUEST_TIMEOUT_MS", 300_000).default(15_000),
  KEEP_ALIVE_TIMEOUT_MS: positiveInteger("KEEP_ALIVE_TIMEOUT_MS", 300_000).default(5_000),
  BODY_LIMIT_BYTES: positiveInteger("BODY_LIMIT_BYTES", 10_485_760).default(16_384),
  MAX_AUTHORIZATION_HEADER_LENGTH: positiveInteger("MAX_AUTHORIZATION_HEADER_LENGTH", 65_536).default(8_192),
  FINANCIAL_WORKER_INTERVAL_MS: positiveInteger("FINANCIAL_WORKER_INTERVAL_MS", 86_400_000).default(60_000),
  FINANCIAL_WORKER_BATCH_SIZE: positiveInteger("FINANCIAL_WORKER_BATCH_SIZE", 500).default(50),
  FINANCIAL_WORKER_LEASE_SECONDS: positiveInteger("FINANCIAL_WORKER_LEASE_SECONDS", 86_400).default(300),
  FINANCIAL_WORKER_RELEASE_BACKOFF_SECONDS: positiveInteger("FINANCIAL_WORKER_RELEASE_BACKOFF_SECONDS", 86_400).default(60),
  FINANCIAL_WORKER_LOG_LEVEL: logLevel,
  FINANCIAL_WORKER_WORKER_ID: z.string().trim().min(1).max(128).optional(),
  SENTRY_DSN: z.string().url().or(z.literal("")).default(""),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "development" && value.TUTORIA_ENVIRONMENT !== "staging") {
    for (const [field, url] of [["SUPABASE_URL", value.SUPABASE_URL], ...value.FRONTEND_ORIGINS.map((url) => ["FRONTEND_ORIGINS", url])] as const) {
      if (new URL(url).protocol !== "https:") context.addIssue({ code: "custom", path: [field], message: "must use HTTPS outside development" });
    }
  }
  const vnpayFields = [value.VNPAY_TMN_CODE, value.VNPAY_HASH_SECRET, value.VNPAY_RETURN_URL, value.VNPAY_IPN_URL];
  if (vnpayFields.some(Boolean) && vnpayFields.some((field) => !field)) context.addIssue({ code: "custom", path: ["VNPAY_TMN_CODE"], message: "VNPay configuration must be complete when enabled" });
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
