const ENVIRONMENTS = new Set(["development", "test", "staging", "production"]);

function normalizedUrl(value, name, environment) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error(`Invalid authentication configuration: ${name}`); }
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(environment === "development" && loopback && url.protocol === "http:")) {
    throw new Error(`Invalid authentication configuration: ${name} must use HTTPS`);
  }
  return url.toString().replace(/\/$/, "");
}

export function validateAuthConfig(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid authentication configuration: TUTORIA_CONFIG is required");
  if (!ENVIRONMENTS.has(input.environment)) throw new Error("Invalid authentication configuration: environment");
  if (typeof input.demoMode !== "boolean") throw new Error("Invalid authentication configuration: demoMode");
  if (input.environment === "production" && input.demoMode) throw new Error("Invalid authentication configuration: production demoMode must be false");
  const apiBaseUrl = normalizedUrl(input.apiBaseUrl, "apiBaseUrl", input.environment);
  if (input.demoMode) return Object.freeze({ ...input, apiBaseUrl, supabaseUrl: input.supabaseUrl || "", supabasePublishableKey: input.supabasePublishableKey || "", authCallbackUrl: input.authCallbackUrl || "" });
  const supabaseUrl = normalizedUrl(input.supabaseUrl, "supabaseUrl", input.environment);
  if (typeof input.supabasePublishableKey !== "string" || !input.supabasePublishableKey.trim()) throw new Error("Invalid authentication configuration: supabasePublishableKey");
  const authCallbackUrl = normalizedUrl(input.authCallbackUrl, "authCallbackUrl", input.environment);
  const callback = new URL(authCallbackUrl);
  if (callback.pathname !== "/auth/callback" || callback.search || callback.hash) throw new Error("Invalid authentication configuration: authCallbackUrl");
  return Object.freeze({ ...input, apiBaseUrl, supabaseUrl, authCallbackUrl, supabasePublishableKey: input.supabasePublishableKey.trim() });
}

export function readRuntimeConfig(globalObject = window) { return validateAuthConfig(globalObject.TUTORIA_CONFIG); }
