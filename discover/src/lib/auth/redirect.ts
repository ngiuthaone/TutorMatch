const DEFAULT_REDIRECT = "/discover";

/**
 * Returns an internal, same-origin path or the fallback.
 *
 * Post-auth redirect targets are browser-controlled query parameters, so they
 * must never become open redirects to arbitrary external origins.
 */
export function safeRedirectPath(value: string | string[] | null | undefined, fallback = DEFAULT_REDIRECT): string {
  const path = Array.isArray(value) ? value[0] : value;
  if (typeof path !== "string" || !path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  // C0 controls (tab, LF, CR, …) and DEL are stripped by URL parsers, so a value
  // like "/\n//evil.example.com" would otherwise be re-interpreted as external.
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback;
  return path;
}
