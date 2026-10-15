/**
 * نسخة الجهاز: ترتيل يعمل كاملاً داخل التطبيق دون خادم.
 * عدة حسابات على الجهاز نفسه بأدوار مختلفة، والبيانات تبقى بعد إعادة فتح التطبيق.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  PASSWORD,
  createCenterViaUi,
  seedCircle,
  trpcMutation,
  trpcQuery,
} from "../tests/helpers";

test.describe.configure({ mode: "serial" });

const MANAGER_PHONE = "776100200";
const TEACHER_PHONE = "777300400";

let context: BrowserContext;
let page: Page;

/** بعد كل فتح للصفحة: انتظر تحميل قاعدة SQLite المحلية وتثبيت الجسر. */
async function ready(target: Page = page) {
  await target.waitForFunction(
    () =>
      (globalThis as { __tarteelLocalReady?: boolean }).__tarteelLocalReady ===
      true
  );
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

async function registerByPhone(
  name: string,
  phone: string,
  inviteCode?: string
) {
  await open("/login");
  await page.getByRole("tab", { name: "حساب جديد" }).click();
  if (inviteCode) {
    await page.getByRole("button", { name: /معي كود دخول/ }).click();
    await page.getByLabel("رمز الدعوة أو كود الدخول").fill(inviteCode);
  }
  await page.getByLabel("الاسم الكامل").fill(name);
  await page.getByRole("radio", { name: "برقم الهاتف" }).click();
  await page.getByLabel("رقم الهاتف").fill(phone);
  await page.getByLabel("كلمة المرور").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
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

const me = () =>
  trpcQuery<{ name: string; phone: string | null } | null>(
    page,
    "auth.me",
    undefined
  );

let teacherCode = "";
let seeded = { centerId: 0, circleId: 0 };

test("لا يوجد خادم: الصفحة تعمل وطلبات /api لا تخرج إلى الشبكة", async () => {
  const outgoing: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      outgoing.push(request.url());
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
  const { centerId, circleId } = await seedCircle(page, [
    "عبدالله أحمد",
    "محمد علي",
  ]);
  seeded = { centerId, circleId };
  const created = await trpcMutation(page, "access.codes.create", {
    centerId,
    role: "teacher",
    circleId,
    maxUses: 1,
    scopes: [],
  });
  teacherCode = (created as { code: string }).code;
  expect(teacherCode).toMatch(/^TRT-/);
});

test("البيانات والجلسة تبقى بعد إعادة فتح التطبيق", async () => {
  await page.reload();
  await ready();
  await open("/dashboard");
  expect(await me()).toMatchObject({
    name: "مدير المركز",
    phone: `+967${MANAGER_PHONE}`,
  });
  const centers = await trpcQuery<{ name: string }[]>(page, "centers.list", {});
  expect(centers.map(center => center.name)).toContain("مركز النور");
  // تبويب جديد = إغلاق التطبيق وفتحه: يقرأ القاعدة المحفوظة في IndexedDB.
  const reopened = await context.newPage();
  await open("/dashboard", reopened);
  await expect(
    reopened.getByRole("heading", { name: "مدير المركز" }).first()
  ).toBeVisible();
  // المركز الوحيد يُختار تلقائياً في لوحة المدير فيظهر ملفه مباشرة دون قائمة اختيار.
  await expect(
    reopened.getByRole("heading", { name: "مركز النور" }).first()
  ).toBeVisible();
  await reopened.close();
});

test("حساب ثانٍ على الجهاز نفسه: معلم يسجل بكود الوصول فيرى حلقته فقط", async () => {
  await logout();
  expect(await me()).toBeNull();
  await registerByPhone("الشيخ خالد", TEACHER_PHONE, teacherCode);
  expect(await me()).toMatchObject({ name: "الشيخ خالد" });
  const circles = await trpcQuery<{ name: string }[]>(page, "circles.list", {});
  expect(circles.map(circle => circle.name)).toEqual(["حلقة أبي بكر"]);
});

test("كلمة مرور خاطئة تُرفض، ثم يعود المدير بحسابه ويرى بياناته", async () => {
  await logout();
  await loginByPhone(`+967 ${MANAGER_PHONE}`, "Wrong9999");
  await expect(
    page.getByText("رقم الهاتف أو كلمة المرور غير صحيحة")
  ).toBeVisible();
  await loginByPhone(`+967 ${MANAGER_PHONE}`);
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  expect(await me()).toMatchObject({ name: "مدير المركز" });
  const students = await trpcQuery<{ name: string }[]>(
    page,
    "students.list",
    {}
  );
  expect(students.map(student => student.name).sort()).toEqual([
    "عبدالله أحمد",
    "محمد علي",
  ]);
});

test("السجل اليومي والتقرير يعملان على الجهاز دون خادم، وPDF يُطلب من التطبيق", async () => {
  const api = (path: string, json: unknown) => trpcMutation(page, `daily.${path}`, json);
  const halaqa = seeded.circleId;
  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date())
  );
  const opened = (await api("open", { halaqa, date: today })) as { id: string };
  const record = Number(opened.id);
  const sheet = await trpcQuery<{ students: { student_id: string; name: string; version: number }[] }>(
    page,
    "daily.sheet",
    { halaqa, date: today }
  );
  await api("setAttendanceBulk", {
    record,
    rows: sheet.students.map(s => ({ student: Number(s.student_id), status: "present", version: s.version })),
  });
  const after = await trpcQuery<{ students: { student_id: string; name: string; version: number }[] }>(
    page,
    "daily.sheet",
    { halaqa, date: today }
  );
  const first = after.students.find(s => s.name === "عبدالله أحمد")!;
  await api("saveEntry", {
    record,
    student: Number(first.student_id),
    version: first.version,
    payload: { memorize: { segments: [{ surah_name: "الملك", from_ayah: 1, to_ayah: 10 }], grade: 5 } },
  });
  const history = await trpcQuery<{ present: number; memorized: number }[]>(page, "daily.history", { halaqa });
  expect(history[0]).toMatchObject({ present: 2, memorized: 1 });

  // قائمة الطلاب تعرض آخر حفظ من السجل اليومي، لا القيمة الافتراضية القديمة (الفاتحة، آية 1).
  const lastMemorize = await trpcQuery<Record<string, { surah_name: string; from_ayah: number; to_ayah: number }>>(
    page,
    "daily.lastMemorize",
    undefined
  );
  expect(lastMemorize[String(first.student_id)]).toMatchObject({ surah_name: "الملك", from_ayah: 1, to_ayah: 10 });
  expect(Object.keys(lastMemorize)).toHaveLength(1);
  await open("/students");
  await expect(page.getByText(/آخر حفظ: الملك/)).toBeVisible();
  await expect(page.getByText("آخر حفظ: لم يُسجَّل بعد")).toBeVisible();

  // داخل تطبيق أندرويد: «تحميل PDF» يرسل التقرير HTML إلى التطبيق (expo-print) بدل نافذة الطباعة.
  await page.evaluate(() => {
    const sent: string[] = [];
    (window as unknown as { __sent: string[] }).__sent = sent;
    (window as unknown as { ReactNativeWebView: { postMessage: (d: string) => void } }).ReactNativeWebView = {
      postMessage: d => sent.push(d),
    };
  });
  await page.evaluate(path => {
    history.pushState(null, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, `/reports?halaqa=${halaqa}`);
  await page.getByRole("button", { name: /معاينة التقرير/ }).click();
  await page.getByRole("button", { name: /تحميل PDF/ }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __sent: string[] }).__sent.length))
    .toBeGreaterThan(0);
  const message = JSON.parse(
    await page.evaluate(() => (window as unknown as { __sent: string[] }).__sent.at(-1)!)
  ) as { type: string; html: string; filename: string };
  expect(message.type).toBe("pdf");
  expect(message.filename).toMatch(/\.pdf$/);
  expect(message.html).toContain("عبدالله أحمد");
  expect(message.html).toContain("@font-face");
});

// الملف في الذاكرة: setInputFiles بمسار يحوي حروفاً عربية (مجلد نتائج الاختبار) لا يصل إلى الحقل.
let backupBytes = Buffer.alloc(0);
const backupFile = () => ({ name: "tarteel-backup.sqlite", mimeType: "application/x-sqlite3", buffer: backupBytes });

const studentNames = async () =>
  (await trpcQuery<{ name: string }[]>(page, "students.list", {}))
    .map(student => student.name)
    .sort();

test("المعلم لا يرى أزرار النسخ الاحتياطي (النسخة تحوي كل الحسابات)", async () => {
  await logout();
  await loginByPhone(`+967 ${TEACHER_PHONE}`);
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  await open("/settings");
  const card = page.getByTestId("device-backup-card");
  await expect(card.getByText("يصدّرها ويستعيدها مالك المركز فقط")).toBeVisible();
  await expect(card.getByRole("button", { name: "حفظ نسخة احتياطية الآن" })).toHaveCount(0);
});

test("المالك يحفظ نسخة احتياطية ثم يستعيدها فتعود البيانات كما كانت", async () => {
  await logout();
  await loginByPhone(`+967 ${MANAGER_PHONE}`);
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  await open("/settings");
  const card = page.getByTestId("device-backup-card");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("button", { name: "حفظ نسخة احتياطية الآن" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^tarteel-backup-\d{4}-\d{2}-\d{2}-\d{4}\.sqlite$/);
  const backupPath = test.info().outputPath("backup.sqlite");
  await download.saveAs(backupPath);
  backupBytes = (await import("node:fs")).readFileSync(backupPath);
  expect(backupBytes.subarray(0, 15).toString("latin1")).toBe("SQLite format 3");
  await expect(card.getByText(/آخر نسخة من هذا الجهاز/)).toBeVisible();

  // تغيير بعد النسخة يجب أن يختفي بالاستعادة.
  await trpcMutation(page, "students.create", { circleId: seeded.circleId, name: "طالب بعد النسخة" });
  expect(await studentNames()).toContain("طالب بعد النسخة");

  await open("/settings");
  await page.getByTestId("backup-file-input").setInputFiles(backupFile());
  await expect(card.getByText("الطلاب: 2")).toBeVisible();
  await card.getByRole("button", { name: "استبدال البيانات بهذه النسخة" }).click();
  await page.waitForURL(url => url.pathname === "/login" && url.search.includes("restored=1"));
  await ready();
  await expect(page.getByText("استُعيدت النسخة الاحتياطية؛ ادخل بحسابك")).toBeVisible();
  expect(await me()).toBeNull();

  await loginByPhone(`+967 ${MANAGER_PHONE}`);
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  expect(await studentNames()).toEqual(["عبدالله أحمد", "محمد علي"]);
});

test("ملف ليس نسخة من ترتيل يُرفض دون المساس بالبيانات", async () => {
  await open("/settings");
  await page.getByTestId("backup-file-input").setInputFiles({
    name: "notes.sqlite",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("ليس ملف قاعدة بيانات ".repeat(100)),
  });
  await expect(page.getByText("هذا الملف ليس نسخة احتياطية من ترتيل")).toBeVisible();
  expect(await studentNames()).toEqual(["عبدالله أحمد", "محمد علي"]);
});

test("جهاز جديد: الاستعادة من صفحة الدخول تعيد الحسابات والبيانات", async ({ browser }) => {
  const fresh = await browser.newContext({ ...test.info().project.use });
  const device = await fresh.newPage();
  try {
    await open("/login", device);
    const restore = device.getByTestId("login-restore");
    await expect(restore.getByText("جهاز جديد؟")).toBeVisible();
    await device.getByTestId("backup-file-input").setInputFiles(backupFile());
    await restore.getByRole("button", { name: "استبدال البيانات بهذه النسخة" }).click();
    await device.waitForURL(url => url.search.includes("restored=1"));
    await ready(device);
    await expect(device.getByTestId("login-restore")).toHaveCount(0);
    await device.getByLabel(/رقم الهاتف/).fill(`+967 ${MANAGER_PHONE}`);
    await device.getByLabel("كلمة المرور").fill(PASSWORD);
    await device.locator("form button[type=submit]").click();
    await device.waitForURL(url => !url.pathname.startsWith("/login"));
    const students = await trpcQuery<{ name: string }[]>(device, "students.list", {});
    expect(students.map(student => student.name).sort()).toEqual(["عبدالله أحمد", "محمد علي"]);
  } finally {
    await fresh.close();
  }
});

test("نسيت كلمة المرور على الجهاز: المالك يفتح نموذج التعيين للمعلم فيدخل بكلمته الجديدة", async () => {
  const NEW_PASSWORD = "Jadeed2026x";
  await logout();
  await expect(page.getByText(/يعيّنها لك مالك المركز على هذا الجهاز/)).toBeVisible();
  await loginByPhone(`+967 ${MANAGER_PHONE}`);
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  await open("/access-management");
  const row = page.locator("tr", { hasText: "الشيخ خالد" });
  // المالك لا يرى الزر لنفسه، ويراه للمعلم.
  await expect(page.locator("tr", { hasText: "مدير المركز" }).getByRole("button", { name: "تعيين كلمة المرور" })).toHaveCount(0);
  await row.getByRole("button", { name: "تعيين كلمة المرور" }).click();
  // نافذة التأكيد الموحدة في التطبيق (بدل نافذة المتصفح).
  await page.getByRole("alertdialog").getByRole("button", { name: "متابعة" }).click();
  await page.waitForURL(url => url.pathname === "/set-password");
  await ready();
  await page.getByLabel("كلمة المرور الجديدة").fill(NEW_PASSWORD);
  await page.getByLabel("تأكيد كلمة المرور").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "حفظ والدخول" }).click();
  await page.waitForURL(url => url.pathname === "/dashboard");
  await ready();
  expect(await me()).toMatchObject({ name: "الشيخ خالد" });

  await logout();
  await loginByPhone(`+967 ${TEACHER_PHONE}`, NEW_PASSWORD);
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  expect(await me()).toMatchObject({ name: "الشيخ خالد" });

  // المرشد الذكي يحتاج الخادم: لا يظهر في القائمة، ورابطه يعود إلى اللوحة.
  await expect(page.getByRole("link", { name: "المرشد الذكي" })).toHaveCount(0);
  await open("/assistant");
  await page.waitForURL(url => url.pathname === "/dashboard");
});

test("إنشاء حساب لا يحتاج كوداً: الكود الخاطئ يُرفض برسالة واضحة، ثم ينشأ الحساب دونه", async () => {
  await logout();
  await open("/login");
  await page.getByRole("tab", { name: "حساب جديد" }).click();
  // حقل الكود مخفي افتراضياً؛ يظهر فقط لمن معه كود.
  await expect(page.getByLabel("رمز الدعوة أو كود الدخول")).toHaveCount(0);
  await page.getByRole("button", { name: /معي كود دخول/ }).click();
  await page.getByLabel("رمز الدعوة أو كود الدخول").fill("TRTL-1234ABCD");
  await page.getByLabel("الاسم الكامل").fill("مستخدم جديد");
  await page.getByRole("radio", { name: "برقم الهاتف" }).click();
  await page.getByLabel("رقم الهاتف").fill("776343551");
  await page.getByLabel("كلمة المرور").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByText("كود الدخول غير صحيح أو منتهٍ")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "إنشاء الحساب دون كود" }).click();
  await expect(page.getByLabel("رمز الدعوة أو كود الدخول")).toHaveCount(0);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(url => url.pathname.startsWith("/start"));
  expect(await me()).toMatchObject({ name: "مستخدم جديد", phone: "+967776343551" });
  await expect(page.getByText("الانضمام إلى مركز قائم")).toBeVisible();
});

test("الوضع الليلي: يُطبَّق قبل أول رسم، والخلفية والبطاقات والنصوص داكنة فعلاً (لا خلفية فاتحة بنص فاتح)", async () => {
  await open("/login");
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await open("/login");
  const colors = await page.evaluate(() => {
    const luminance = (value: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data).map(c => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const body = getComputedStyle(document.body);
    return {
      dark: document.documentElement.classList.contains("dark"),
      scheme: document.documentElement.style.colorScheme,
      background: luminance(body.backgroundColor),
      text: luminance(body.color),
    };
  });
  expect(colors.dark).toBe(true);
  expect(colors.scheme).toBe("dark");
  expect(colors.background).toBeLessThan(0.05);
  const ratio = (colors.text + 0.05) / (colors.background + 0.05);
  expect(ratio).toBeGreaterThan(7);
  await page.evaluate(() => localStorage.setItem("theme", "light"));
});
