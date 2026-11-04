import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./src",
  testMatch: ["**/test/*.playwright.ts", "**/test/*.playwright.tsx"],
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/__screenshots__/{projectName}/{arg}{ext}",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.002 },
  },
  use: {
    browserName: "chromium",
    viewport: { width: 1100, height: 900 },
    locale: "ru-RU",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "light", use: { colorScheme: "light" } },
    { name: "dark", use: { colorScheme: "dark" } },
  ],
  webServer: [
    {
      command: "npm run preview:fixtures",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
    {
      command: "node ../scripts/serve-frontend.mjs storybook-static 6006",
      url: "http://127.0.0.1:6006",
      reuseExistingServer: false,
    },
    {
      command: "node ../scripts/serve-frontend.mjs dist 4174",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: false,
    },
  ],
});
