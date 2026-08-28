import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "jsdom", include: ["test/auth/**/*.test.js", "test/tutor-cv/**/*.test.js"], restoreMocks: true, clearMocks: true } });
