import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: { headless: true },
  outputDir: "/tmp/pw-results",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
