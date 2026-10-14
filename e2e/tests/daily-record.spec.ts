/**
 * المسار اليومي الكامل لمدير المركز في السجل اليومي للحلقة: فتح اليوم ← الحضور والغياب ← تسميع الحفظ
 * ← إنهاء اليوم ← ظهوره في السجلات السابقة وصفحة الحلقة وملف الطالب ← معاينة تقرير الحلقة بأرقامه.
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
test.use({ viewport: { width: 390, height: 844 } });

let page: Page;
let circleId = 0;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await registerViaUi(page, "مدير المركز", uniqueEmail("manager"));
  await createCenterViaUi(page, `مركز النور ${Date.now()}`);
  ({ circleId } = await seedCircle(page, STUDENTS));
});

test.afterAll(async () => {
  await page?.close();
});

const attendance = (name: string) =>
  page.getByRole("radiogroup", { name: `حضور ${name}` });

test("الروابط القديمة للفترات تفتح السجل اليومي، وقائمة التنقل تعرضه", async () => {
  await page.goto("/periods/12");
  await page.waitForURL(/\/daily/);
  await expect(
    page.getByRole("heading", { name: "السجل اليومي للحلقة" })
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /السجل/ }).first()).toBeVisible();
});

test("الحضور: غياب طالب ثم «الجميع حاضر» لا يغيّر الغياب المسجّل", async () => {
  await page.goto(`/daily?halaqa=${circleId}`);
  for (const name of STUDENTS) await expect(attendance(name)).toBeVisible();
  await attendance("يوسف سالم").getByRole("radio", { name: "غائب" }).click();
  await expect(
    attendance("يوسف سالم").getByRole("radio", { name: "غائب" })
  ).toBeChecked();
  await page.getByRole("button", { name: /الجميع حاضر/ }).click();
  await expect(page.getByText("سُجّل 2 حاضرين.")).toBeVisible();
  for (const name of ["عبدالله أحمد", "محمد علي"])
    await expect(
      attendance(name).getByRole("radio", { name: "حاضر" })
    ).toBeChecked();
  await expect(
    attendance("يوسف سالم").getByRole("radio", { name: "غائب" })
  ).toBeChecked();
});

test("الحفظ: تسميع الملك 1–10 بتقدير ممتاز يُحفظ تلقائياً ويظهر في بطاقة الطالب", async () => {
  await page.getByRole("button", { name: /تفاصيل عبدالله أحمد/ }).click();
  await page.getByRole("button", { name: /إضافة حفظ/ }).click();
  await page
    .getByRole("button", { name: /من سورة|اختر السورة/ })
    .first()
    .click();
  await page.getByPlaceholder(/ابحث باسم السورة/).fill("الملك");
  await page.getByRole("button", { name: /الملك/ }).first().click();
  await page.getByLabel("من آية").fill("1");
  await page.getByLabel("إلى آية").fill("10");
  await page.getByRole("radio", { name: "ممتاز" }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "إغلاق" }).first().click();
  await expect(page.getByText(/حفظ اليوم: الملك 1.10/)).toBeVisible();
});

test("إنهاء اليوم يعرض التنبيهات ثم يظهر اليوم مكتملاً في السجلات السابقة", async () => {
  await page.getByRole("button", { name: "إنهاء سجل اليوم" }).click();
  await expect(page.getByText(/حاضر بلا حفظ ولا مراجعة \(1\)/)).toBeVisible();
  await page.getByRole("button", { name: "إنهاء رغم التنبيهات" }).click();
  await expect(page.getByText("اكتمل سجل اليوم.").first()).toBeVisible();
  await page.getByRole("tab", { name: "السجلات السابقة" }).click();
  await expect(page.getByText("مكتمل").first()).toBeVisible();
});

test("صفحة الحلقة وملف الطالب يقرآن من السجل اليومي", async () => {
  await page.goto(`/circles/${circleId}`);
  await expect(
    page.getByRole("link", { name: /متابعة سجل اليوم/ })
  ).toBeVisible();
  await expect(page.getByText("آخر حفظ: الملك 1–10")).toBeVisible();
  await page.getByRole("tab", { name: "السجلات السابقة" }).click();
  await expect(page.getByText(/حضور 2 · غياب 1/)).toBeVisible();
  await page.getByRole("tab", { name: "الطلاب" }).click();
  await page.getByRole("link", { name: "عبدالله أحمد" }).click();
  await expect(
    page.getByRole("heading", { name: "عبدالله أحمد" })
  ).toBeVisible();
  await expect(page.getByText("الملك 1–10").first()).toBeVisible();
});

test("تقرير الحلقة يعرض أرقام اليوم المكتمل بهوية ترتيل", async () => {
  await page.goto(`/reports?halaqa=${circleId}`);
  await page.getByRole("button", { name: /معاينة التقرير/ }).click();
  await expect(page.getByRole("button", { name: /تحميل PDF/ })).toBeVisible();
  const frame = page.frameLocator("iframe").first();
  await expect(frame.getByText("تقرير الحلقة").first()).toBeVisible();
  await expect(frame.getByText("عبدالله أحمد").first()).toBeVisible();
  await expect(
    frame.getByText("تم التوليد بواسطة منصة ترتيل").first()
  ).toBeVisible();
});
