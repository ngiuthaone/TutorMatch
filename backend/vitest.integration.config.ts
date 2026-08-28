import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", setupFiles: ["test-integration/local-supabase-setup.ts"], include: ["test-integration/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 30_000 } });
