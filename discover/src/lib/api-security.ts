const UNSAFE_BLOCK = /<\s*(script|iframe|object|embed|frame|meta|link|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const UNSAFE_TAGS = /<\s*\/?(?:script|iframe|object|embed|frame|meta|link|base|form)\b[^>]*>/gi;
const EVENT_HANDLER_ATTR = /\s+on[a-z][a-z0-9_-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_PROTOCOLS = /\b(?:javascript|vbscript|data):/gi;

/** Strips dangerous HTML constructs from user-generated text while keeping normal content. */
export function sanitizeHtmlText(value: string): string {
  let result = String(value || "");
  if (result.length > 100_000) result = result.slice(0, 100_000);
  result = result.replace(UNSAFE_BLOCK, "");
  result = result.replace(UNSAFE_TAGS, "");
  result = result.replace(EVENT_HANDLER_ATTR, "");
  result = result.replace(DANGEROUS_PROTOCOLS, "");
  return result.trim();
}

/** Recursively sanitizes all string values in a JSON tree (used on API input). */
export function sanitizeTree(value: unknown): unknown {
  if (typeof value === "string") return sanitizeHtmlText(value);
  if (Array.isArray(value)) return value.map(sanitizeTree);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = sanitizeTree(item);
    return out;
  }
  return value;
}

/** Allows only HTTPS URLs or same-origin relative paths (for images/links). */
export function isSafeHttpUrl(value: string): boolean {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    if (trimmed.startsWith("//")) return false;
    return true;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  return url.protocol === "https:";
}

/** Plain text length check for message bodies and other short-form user content. */
export function maxLength(value: string, max: number): boolean {
  return String(value || "").length <= max;
}

/** In-memory fixed-window rate limiter keyed by a stable identifier (e.g. verified user id). */
export class InMemoryRateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly max: number, private readonly windowMs: number) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.max) return false;
    entry.count += 1;
    return true;
  }
}
