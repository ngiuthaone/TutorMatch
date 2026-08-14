export type TutoriaEnvironment = "development" | "test" | "staging" | "production";

export interface TutoriaConfig {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  authCallbackUrl: string;
  demoMode: boolean;
  environment: TutoriaEnvironment;
}

const ENVIRONMENTS: TutoriaEnvironment[] = ["development", "test", "staging", "production"];
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizedUrl(value: string, name: string, environment: TutoriaEnvironment, required: boolean): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    if (!required) return "";
    throw new Error(`Invalid Tutoria configuration: ${name} is required`);
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid Tutoria configuration: ${name}`);
  }
  const isLoopback = LOOPBACK.has(url.hostname);
  if (url.protocol !== "https:" && !(environment === "development" && isLoopback && url.protocol === "http:")) {
    throw new Error(`Invalid Tutoria configuration: ${name} must use HTTPS`);
  }
  return url.toString().replace(/\/$/, "");
}

function envFallback(): Partial<TutoriaConfig> {
  const explicitEnvironment = process.env.NEXT_PUBLIC_TUTORIA_ENVIRONMENT;
  const environment = (explicitEnvironment as TutoriaEnvironment | undefined)
    || (process.env.NODE_ENV === "production" ? "production" : "development");
  return {
    apiBaseUrl: process.env.NEXT_PUBLIC_TUTORIA_API_BASE_URL || "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    authCallbackUrl: process.env.NEXT_PUBLIC_TUTORIA_AUTH_CALLBACK_URL || "",
    // Local development stays in the mock/demo experience unless live auth
    // is explicitly enabled with NEXT_PUBLIC_TUTORIA_DEMO_MODE=false.
    demoMode: process.env.NEXT_PUBLIC_TUTORIA_DEMO_MODE !== "false",
    environment,
  };
}

function normalizeConfig(input: TutoriaConfig): TutoriaConfig {
  const environment = ENVIRONMENTS.includes(input.environment) ? input.environment : "development";
  if (environment === "production" && input.demoMode) {
    throw new Error("Invalid Tutoria configuration: production demoMode must be false");
  }
  const apiBaseUrl = normalizedUrl(input.apiBaseUrl, "apiBaseUrl", environment, !input.demoMode);
  if (input.demoMode) {
    return Object.freeze({ ...input, environment, apiBaseUrl, supabaseUrl: "", supabasePublishableKey: "", authCallbackUrl: "" });
  }
  const supabaseUrl = normalizedUrl(input.supabaseUrl, "supabaseUrl", environment, true);
  const supabasePublishableKey = String(input.supabasePublishableKey || "").trim();
  if (!supabasePublishableKey) throw new Error("Invalid Tutoria configuration: supabasePublishableKey");
  const authCallbackUrl = normalizedUrl(input.authCallbackUrl, "authCallbackUrl", environment, false);
  if (authCallbackUrl) {
    const callback = new URL(authCallbackUrl);
    if (callback.pathname !== "/auth/callback" || callback.search || callback.hash) {
      throw new Error("Invalid Tutoria configuration: authCallbackUrl");
    }
  }
  return Object.freeze({ ...input, environment, apiBaseUrl, supabaseUrl, supabasePublishableKey, authCallbackUrl });
}

let cached: TutoriaConfig | null = null;
let configError: string | null = null;

function browserOverride(): Partial<TutoriaConfig> {
  if (typeof window === "undefined") return {};
  try {
    const globalConfig = (window as unknown as { TUTORIA_CONFIG?: Partial<TutoriaConfig> }).TUTORIA_CONFIG;
    if (!globalConfig || typeof globalConfig !== "object") return {};
    const merged: Partial<TutoriaConfig> = {};
    for (const key of ["apiBaseUrl", "supabaseUrl", "supabasePublishableKey", "authCallbackUrl", "demoMode", "environment"] as const) {
      const value = globalConfig[key];
      if (value !== undefined) merged[key] = value as never;
    }
    return merged;
  } catch {
    return {};
  }
}

export function getRuntimeConfig(): TutoriaConfig {
  if (cached) return cached;
  const merged: TutoriaConfig = { ...envFallback(), ...browserOverride() } as TutoriaConfig;
  try {
    cached = normalizeConfig(merged);
    configError = null;
  } catch (error) {
    configError = error instanceof Error ? error.message : "Invalid Tutoria configuration";
    throw error;
  }
  return cached as TutoriaConfig;
}

export function getConfigError(): string | null {
  return configError;
}

export function resetRuntimeConfigForTests(): void {
  cached = null;
  configError = null;
}

/** True when real Supabase auth and the production backend are configured. Never throws for missing config. */
export function isLiveMode(config: TutoriaConfig = safeConfig()): boolean {
  return !config.demoMode && Boolean(config.supabaseUrl && config.supabasePublishableKey && config.apiBaseUrl);
}

export function getApiBaseUrl(config: TutoriaConfig = safeConfig()): string {
  return config.apiBaseUrl;
}

export function getAuthCallbackUrl(config: TutoriaConfig = safeConfig()): string {
  return config.authCallbackUrl || (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "");
}

function isRuntimeProduction(): boolean {
  return (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_TUTORIA_ENVIRONMENT === "production")
    && process.env.NEXT_PHASE !== "phase-production-build";
}

/** Returns a config for safe lookup. Fails closed (rethrows) in production runtime; demo fallback only in dev or during build/prerender. */
function safeConfig(): TutoriaConfig {
  try {
    return getRuntimeConfig();
  } catch (error) {
    configError = error instanceof Error ? error.message : "Invalid Tutoria configuration";
    if (isRuntimeProduction()) throw error;
    return Object.freeze({
      apiBaseUrl: "",
      supabaseUrl: "",
      supabasePublishableKey: "",
      authCallbackUrl: "",
      demoMode: true,
      environment: "development",
    });
  }
}

/** Loads a same-origin /config.js override once, when env fallbacks are absent. */
export async function loadExternalConfig(): Promise<void> {
  if (cached || typeof window === "undefined") return;
  const fallback = envFallback();
  if (fallback.supabaseUrl && fallback.supabasePublishableKey) return;
  try {
    const response = await fetch("/config.js", { cache: "no-store" });
    if (!response.ok) return;
    const source = await response.text();
    const mount = window.document.createElement("script");
    mount.textContent = source;
    window.document.head.appendChild(mount);
  } catch {
    // No external config file; env fallbacks remain the source of truth.
  }
}
