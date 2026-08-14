import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getConfigError, getRuntimeConfig, isLiveMode, resetRuntimeConfigForTests } from "@/lib/auth/config";

describe("Tutoria config fail-closed behavior", () => {
  beforeEach(() => {
    resetRuntimeConfigForTests();
  });

afterEach(() => {
    vi.unstubAllEnvs();
    resetRuntimeConfigForTests();
  });

  function liveEnv() {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk_test_123");
    vi.stubEnv("NEXT_PUBLIC_TUTORIA_API_BASE_URL", "https://api.tutoria.example.com");
  }

  it("loads a full live configuration when all keys are present", () => {
    vi.stubEnv("NEXT_PUBLIC_TUTORIA_DEMO_MODE", "false");
    liveEnv();
    const config = getRuntimeConfig();
    expect(config.demoMode).toBe(false);
    expect(config.supabaseUrl).toBe("https://project.supabase.co");
    expect(isLiveMode()).toBe(true);
  });

  it("throws on missing config in a production runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TUTORIA_DEMO_MODE", "false");
    expect(() => getRuntimeConfig()).toThrow(/apiBaseUrl is required/);
    expect(getConfigError()).toMatch(/required/);
  });

  it("fails closed through isLiveMode() in a production runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TUTORIA_DEMO_MODE", "false");
    expect(() => isLiveMode()).toThrow(/required/);
  });

  it("allows the demo fallback during a production build so prerendering succeeds", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("NEXT_PUBLIC_TUTORIA_DEMO_MODE", "false");
    expect(() => getRuntimeConfig()).toThrow(/required/);
    expect(isLiveMode()).toBe(false);
  });

  it("rejects demoMode in production even during build", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("NEXT_PUBLIC_TUTORIA_DEMO_MODE", "true");
    expect(() => getRuntimeConfig()).toThrow(/demoMode must be false/);
    expect(isLiveMode()).toBe(false);
  });

  it("falls back to demo config in development when env is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_TUTORIA_DEMO_MODE", "true");
    const config = getRuntimeConfig();
    expect(config.demoMode).toBe(true);
    expect(config.supabaseUrl).toBe("");
    expect(isLiveMode()).toBe(false);
  });
});
