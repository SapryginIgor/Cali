const { defineConfig, devices } = require("@playwright/test");

const WEB_PORT = 19009;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command:
      `CI=1 EXPO_PUBLIC_E2E=1 EXPO_PUBLIC_E2E_DELAY_MS=1200 npm run start-web -- --port ${WEB_PORT}`,
    url: `http://127.0.0.1:${WEB_PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
