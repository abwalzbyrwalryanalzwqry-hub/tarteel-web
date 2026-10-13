/**
 * المسار اليومي الكامل لمدير المركز: إنشاء مركز ← فترة اليوم ← الحضور والغياب ← تسجيل الحفظ
 * ← اعتماد الفترة ← ظهور الأرقام نفسها في التقرير التنفيذي ← تصدير PDF صالح.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  createCenterViaUi,
  registerViaUi,
  seedCircle,
  uniqueEmail,
} from "./helpers";

const STUDENTS = ["عبدالله أحمد", "محمد علي", "يوسف سالم"];

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await registerViaUi(page, "مدير المركز", uniqueEmail("manager"));
  await createCenterViaUi(page, `مركز النور ${Date.now()}`);
  await seedCircle(page, STUDENTS);
});

test.afterAll(async () => {
  await page?.close();
});

const studentRow = (name: string) =>
  page.locator('[role="button"]', { hasText: name });

test("إنشاء فترة اليوم من صفحة الفترات وفتح سجل الطلاب", async () => {
  await page.goto("/sessions");
  await page.getByRole("button", { name: "إنشاء جلسة اليوم" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("فترة جديدة")).toBeVisible();
  const selects = dialog.locator("select");
  await expect(selects.nth(0)).toHaveValue(/\d+/); // الحلقة الوحيدة مختارة تلقائياً
  await selects.nth(1).selectOption({ label: "الشيخ خالد" });
  await selects.nth(2).selectOption({ label: "العام الدراسي" });
  await dialog
    .getByRole("button", { name: "إنشاء الفترة وفتح سجل الطلاب" })
    .click();
  await page.waitForURL(/\/(periods|sessions)\/\d+/);
  await expect(page.getByText("مسودة", { exact: true })).toBeVisible();
  for (const name of STUDENTS) await expect(studentRow(name)).toBeVisible();
});

test("الحضور: غياب طالب ثم «تسجيل الجميع حضوراً» لا يغيّر الغياب المسجّل", async () => {
  await studentRow("يوسف سالم").getByRole("button", { name: "غائب" }).click();
  await expect(
    studentRow("يوسف سالم").getByRole("button", { name: "غائب" })
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "تسجيل الجميع حضوراً" }).click();
  await expect(page.getByText(/سُجل الحضور لـ 2 من الطلاب/)).toBeVisible();
  for (const name of ["عبدالله أحمد", "محمد علي"])
    await expect(
      studentRow(name).getByRole("button", { name: "حاضر" })
    ).toHaveAttribute("aria-pressed", "true");
  await expect(
    studentRow("يوسف سالم").getByRole("button", { name: "غائب" })
  ).toHaveAttribute("aria-pressed", "true");
});

test("الحفظ: تسجيل صفحة بتقدير ممتاز يظهر في سجل الجلسة", async () => {
  await page.getByRole("button", { name: "الحفظ", exact: true }).click();
  await page.getByText("عبدالله أحمد").last().click();
  const form = page
    .locator("div", {
      has: page.getByRole("button", { name: "تسجيل الحفظ", exact: true }),
    })
    .last();
  await form.locator('input[type="number"]').first().fill("1");
  await form.locator("select").nth(2).selectOption({ label: "ممتاز" });
  await form.getByRole("button", { name: "تسجيل الحفظ", exact: true }).click();
  await expect(page.getByText("تم تسجيل الحفظ")).toBeVisible();
  const log = page
    .locator("div", { hasText: "سجل الحفظ في هذه الجلسة" })
    .last();
  await expect(log.getByText("عبدالله أحمد")).toBeVisible();
  await expect(log.getByText("ممتاز")).toBeVisible();
});

test("اعتماد الفترة بعد المراجعة", async () => {
  await page.getByRole("button", { name: "مراجعة وحفظ الفترة" }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByText("مراجعة اعتماد الفترة")).toBeVisible();
  await review.getByRole("button", { name: "اعتماد الفترة" }).click();
  await expect(
    page.getByText("تم حفظ الفترة واعتماد بياناتها في القوائم والتقارير")
  ).toBeVisible();
  await expect(page.getByText("مسودة", { exact: true })).toHaveCount(0);
});

test("التقرير التنفيذي للحلقة يعرض أرقام الفترة المعتمدة ويصدّر PDF صالحاً", async () => {
  await page.goto("/reports");
  const executive = page
    .locator("div.glass-card", { hasText: "لوحة التقرير التنفيذي للحلقة" })
    .last();
  await executive
    .locator("select")
    .first()
    .selectOption({ label: "حلقة أبي بكر" });
  await executive.getByRole("button", { name: /معاينة قبل/ }).click();
  await expect(page.getByText("معاينة حية جاهزة للتصدير")).toBeVisible();

  const metric = (label: string) =>
    page
      .locator("div", { has: page.getByText(label, { exact: true }) })
      .filter({ hasText: /\d/ })
      .last();
  await expect(metric("الفترات المعتمدة")).toContainText("1");
  await expect(metric("نسبة الحضور")).toContainText("67%");
  await expect(metric("سجلات الحفظ")).toContainText("1");

  const pdfResponse = page.waitForResponse(response =>
    response.url().includes("reporting.exportExecutivePdf")
  );
  await page.getByRole("button", { name: "تجهيز PDF" }).click();
  expect((await pdfResponse).status()).toBe(200);
  const preview = page.getByRole("dialog");
  await expect(preview.getByText("معاينة ملف PDF")).toBeVisible();
  const src = await preview.locator("iframe").getAttribute("src");
  expect(src).toMatch(/^blob:/);
  const [magic, size] = await page.evaluate(async url => {
    const bytes = await (await fetch(url)).arrayBuffer();
    return [
      new TextDecoder().decode(bytes.slice(0, 5)),
      bytes.byteLength,
    ] as const;
  }, src!);
  expect(magic).toBe("%PDF-");
  expect(size).toBeGreaterThan(5_000);
});
