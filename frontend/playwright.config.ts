import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /api\.spec\.ts/,
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      testIgnore: /api\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "api-desktop",
      testMatch: /api\.spec\.ts/,
      use: {
        baseURL: "http://127.0.0.1:5175",
        browserName: "chromium",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "api-mobile",
      testMatch: /api\.spec\.ts/,
      use: {
        baseURL: "http://127.0.0.1:5175",
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: !process.env.CI,
      env: { VITE_DATA_MODE: "demo" },
    },
    {
      command: "npm run dev -- --port 5175 --strictPort",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_DATA_MODE: "api",
        VITE_API_URL: "http://127.0.0.1:5999/api/v1",
        VITE_SUPABASE_URL: "http://127.0.0.1:5998",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_controlled_test_only",
      },
    },
  ],
});
