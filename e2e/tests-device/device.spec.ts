/**
 * نسخة الجهاز: ترتيل يعمل كاملاً داخل التطبيق دون خادم.
 * عدة حسابات على الجهاز نفسه بأدوار مختلفة، والبيانات تبقى بعد إعادة فتح التطبيق.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PASSWORD, createCenterViaUi, seedCircle, trpcMutation, trpcQuery } from "../tests/helpers";

test.describe.configure({ mode: "serial" });

const MANAGER_PHONE = "776100200";
const TEACHER_PHONE = "777300400";

let context: BrowserContext;
let page: Page;

/** بعد كل فتح للصفحة: انتظر تحميل قاعدة SQLite المحلية وتثبيت الجسر. */
async function ready(target: Page = page) {
  await target.waitForFunction(() => (globalThis as { __tarteelLocalReady?: boolean }).__tarteelLocalReady === true);
}

async function open(path: string, target: Page = page) {
  await target.goto(path);
  await ready(target);
}

// سياق واحد = جهاز واحد: كل الحسابات تتشارك قاعدة البيانات المحلية نفسها.
test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ ...test.info().project.use });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

async function registerByPhone(name: string, phone: string, inviteCode?: string) {
  await open("/login");
  await page.getByRole("tab", { name: "حساب جديد" }).click();
  if (inviteCode) await page.getByPlaceholder("TRTL-1234ABCD").fill(inviteCode);
  await page.getByLabel("الاسم الكامل").fill(name);
  await page.getByRole("radio", { name: "برقم الهاتف" }).click();
  await page.getByLabel("رقم الهاتف").fill(phone);
  await page.getByLabel("كلمة المرور").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await ready();
}

async function loginByPhone(phone: string, password = PASSWORD) {
  await open("/login");
  await page.getByLabel(/رقم الهاتف/).fill(phone);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.locator("form button[type=submit]").click();
}

async function logout() {
  await trpcMutation(page, "auth.logout", undefined);
  await open("/login");
}

const me = () => trpcQuery<{ name: string; phone: string | null } | null>(page, "auth.me", undefined);

let teacherCode = "";

test("لا يوجد خادم: الصفحة تعمل وطلبات /api لا تخرج إلى الشبكة", async () => {
  const outgoing: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) outgoing.push(request.url());
  });
  await open("/login");
  await expect(page.getByRole("tab", { name: "حساب جديد" })).toBeVisible();
  expect(await me()).toBeNull();
  expect(outgoing).toEqual([]);
});

test("مدير المركز ينشئ حسابه برقم الهاتف دون رسالة SMS ثم مركزه وحلقته", async () => {
  await registerByPhone("مدير المركز", `0${MANAGER_PHONE}`);
  await expect(page).toHaveURL(/\/start/);
  await createCenterViaUi(page, "مركز النور");
  const { centerId, circleId } = await seedCircle(page, ["عبدالله أحمد", "محمد علي"]);
  const created = await trpcMutation(page, "access.codes.create", { centerId, role: "teacher", circleId, maxUses: 1, scopes: [] });
  teacherCode = (created as { code: string }).code;
  expect(teacherCode).toMatch(/^TRT-/);
});

test("البيانات والجلسة تبقى بعد إعادة فتح التطبيق", async () => {
  await page.reload();
  await ready();
  await open("/dashboard");
  expect(await me()).toMatchObject({ name: "مدير المركز", phone: `+967${MANAGER_PHONE}` });
  const centers = await trpcQuery<{ name: string }[]>(page, "centers.list", {});
  expect(centers.map((center) => center.name)).toContain("مركز النور");
  // تبويب جديد = إغلاق التطبيق وفتحه: يقرأ القاعدة المحفوظة في IndexedDB.
  const reopened = await context.newPage();
  await open("/dashboard", reopened);
  await expect(reopened.getByRole("heading", { name: "مدير المركز" }).first()).toBeVisible();
  await expect(reopened.locator("select option", { hasText: "مركز النور" })).toHaveCount(1);
  await reopened.close();
});

test("حساب ثانٍ على الجهاز نفسه: معلم يسجل بكود الوصول فيرى حلقته فقط", async () => {
  await logout();
  expect(await me()).toBeNull();
  await registerByPhone("الشيخ خالد", TEACHER_PHONE, teacherCode);
  expect(await me()).toMatchObject({ name: "الشيخ خالد" });
  const circles = await trpcQuery<{ name: string }[]>(page, "circles.list", {});
  expect(circles.map((circle) => circle.name)).toEqual(["حلقة أبي بكر"]);
});

test("كلمة مرور خاطئة تُرفض، ثم يعود المدير بحسابه ويرى بياناته", async () => {
  await logout();
  await loginByPhone(`+967 ${MANAGER_PHONE}`, "Wrong9999");
  await expect(page.getByText("رقم الهاتف أو كلمة المرور غير صحيحة")).toBeVisible();
  await loginByPhone(`+967 ${MANAGER_PHONE}`);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  expect(await me()).toMatchObject({ name: "مدير المركز" });
  const students = await trpcQuery<{ name: string }[]>(page, "students.list", {});
  expect(students.map((student) => student.name).sort()).toEqual(["عبدالله أحمد", "محمد علي"]);
});
