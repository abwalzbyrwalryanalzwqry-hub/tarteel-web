/**
 * اختبارات من طرف إلى طرف على الخادم المبني (dist/) وقاعدة MySQL حقيقية.
 *
 *   pnpm build && DATABASE_URL=… pnpm exec drizzle-kit migrate      (من جذر المستودع)
 *   cd e2e && npm ci && npx playwright install chromium
 *   DATABASE_URL=mysql://… npx playwright test
 *
 * يشغّل Playwright الخادم بنفسه على المنفذ 3100 (أو يستخدم E2E_BASE_URL إن ضُبط).
 */
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ar",
    timezoneId: "Asia/Aden",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node dist/index.js",
        cwd: "..",
        url: `${baseURL}/api/health`,
        timeout: 60_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        env: {
          NODE_ENV: "production",
          PORT: String(port),
          DATABASE_URL: process.env.DATABASE_URL ?? "",
          JWT_SECRET:
            process.env.JWT_SECRET ??
            "e2e-secret-e2e-secret-e2e-secret-e2e-secret-0",
          ALLOW_SIGNUP: "true",
          TRUST_PROXY_HOPS: "0",
        },
      },
});
