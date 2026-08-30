import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [
            {
              name: "shootbang-last-seen-announcement",
              value: "2026-08-delta",
            },
          ],
        },
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/apple.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "apple-webkit",
      testMatch: "**/apple.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
