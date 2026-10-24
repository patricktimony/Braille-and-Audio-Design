import { defineConfig, devices } from "@playwright/test";

// Accessibility and keyboard tests run against the production build.
export default defineConfig({
  testDir: "tests/a11y",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npx vite build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // iPhone screen size and touch. Real Safari and VoiceOver still need manual testing (docs/manual-testing.md).
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium", defaultBrowserType: "chromium" } },
  ],
});
