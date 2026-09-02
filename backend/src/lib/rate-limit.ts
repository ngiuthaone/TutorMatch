// Per-route rate-limit configuration helper.
//
// Pattern adapted from UpSpace (MIT) — express-rate-limit's per-route preHandler pattern —
// translated to Tutoria's existing Fastify + @fastify/rate-limit stack. The global limiter
// is registered in plugins/security.ts; this helper produces a per-route `config.rateLimit`
// override that Tightens the global default for sensitive endpoints (security alerts, password
// reset, etc.).
//
// IMPORTANT: this is in-process. For multi-instance production deployments, swap the global
// `@fastify/rate-limit` Redis store (https://github.com/fastify/fastify-rate-limit#redis) so
// counters are shared across replicas.
import type { RateLimitOptions } from "@fastify/rate-limit";

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export function rateLimit(config: RateLimitConfig): { rateLimit: RateLimitOptions } {
  return { rateLimit: { max: config.max, timeWindow: config.windowMs } };
}

// Common presets used across routes in this codebase. Centralized so a single edit can
// tune all sensitive endpoints at once.
export const RATE_LIMIT_PRESETS = {
  securityAlert: { max: 5, windowMs: 60_000 },
  passwordReset: { max: 3, windowMs: 60_000 },
  signIn: { max: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>;
