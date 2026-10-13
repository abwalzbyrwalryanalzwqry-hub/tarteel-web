import { defineConfig } from "drizzle-kit";

// ترحيلات نسخة ترتيل المحلية (SQLite داخل تطبيق أندرويد). لا تحتاج قاعدة بيانات للتوليد.
// التوليد: pnpm db:sqlite (يحوّل المخطط ثم يولّد ترحيلاً جديداً إن تغيّر).
export default defineConfig({
  schema: "./drizzle/schema.sqlite.ts",
  out: "./drizzle-sqlite",
  dialect: "sqlite",
});
