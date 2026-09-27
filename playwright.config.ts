import { defineConfig, devices } from "@playwright/test";
import { UPDATE_ANNOUNCEMENT_ID } from "./lib/updateAnnouncement";

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
              value: UPDATE_ANNOUNCEMENT_ID,
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
    command: process.platform === "win32"
      ? 'C:\\nvm4w\\nodejs\\corepack.cmd pnpm dev'
      : "corepack pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
