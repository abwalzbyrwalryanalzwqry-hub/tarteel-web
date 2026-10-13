/**
 * اختبارات نسخة الجهاز (تطبيق أندرويد دون خادم): الواجهة المبنية بـ `pnpm build:local`
 * تعمل وحدها في المتصفح، ومنطق ترتيل كله على SQLite داخل الصفحة. لا خادم ولا MySQL.
 *
 *   pnpm build:local                      (من جذر المستودع)
 *   cd e2e && npx playwright test -c playwright.device.config.ts
 */
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_DEVICE_PORT ?? 4310);
const baseURL = process.env.E2E_DEVICE_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests-device",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ar",
    timezoneId: "Asia/Aden",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // شاشة هاتف: هذه النسخة تعمل داخل تطبيق أندرويد.
  projects: [{ name: "android-webview", use: { ...devices["Pixel 7"] } }],
  webServer: process.env.E2E_DEVICE_BASE_URL
    ? undefined
    : {
        // ملفات ثابتة فقط (dist/local)؛ لا يوجد /api في هذه النسخة.
        command: `pnpm exec vite preview --mode device --port ${port} --strictPort --host 127.0.0.1`,
        cwd: "..",
        url: `${baseURL}/login`,
        timeout: 60_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
      },
});
