import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Quran1234";
export const uniqueEmail = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@e2e.test`;

/** ينشئ حساباً من تبويب «حساب جديد» في صفحة الدخول وينتظر مغادرة الصفحة. */
export async function registerViaUi(
  page: Page,
  name: string,
  email: string,
  password = PASSWORD
) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "حساب جديد" }).click();
  await page.getByLabel("الاسم الكامل").fill(name);
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
}

export async function loginViaUi(
  page: Page,
  email: string,
  password = PASSWORD
) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.locator("form button[type=submit]").click();
}

/** ينشئ مركزاً مستقلاً من صفحة البداية؛ يصبح الحساب مالكه ومديره. */
export async function createCenterViaUi(page: Page, centerName: string) {
  await page.goto("/start");
  await page.getByText("إنشاء مركز جديد").first().click();
  await page
    .getByPlaceholder("مثال: مركز النور لتحفيظ القرآن")
    .fill(centerName);
  await page.getByRole("button", { name: "إنشاء المركز وبدء الإدارة" }).click();
  await expect(page.getByText("تم إنشاء مركزك بنجاح")).toBeVisible();
}

type Meta = { values: Record<string, ["Date"]> };

/** استدعاء tRPC من داخل الصفحة (بكوكي الجلسة نفسه)، بصيغة superjson. */
export async function trpcMutation(
  page: Page,
  path: string,
  json: unknown,
  dateKeys: string[] = []
) {
  const meta: Meta | undefined = dateKeys.length
    ? { values: Object.fromEntries(dateKeys.map(key => [key, ["Date"]])) }
    : undefined;
  const body = await page.evaluate(
    async ([path, json, meta]) => {
      const response = await fetch(`/api/trpc/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(meta ? { json, meta } : { json }),
      });
      return response.json();
    },
    [path, json, meta] as const
  );
  if (body.error) throw new Error(`${path}: ${body.error.json?.message}`);
  return body.result?.data?.json;
}

export async function trpcQuery<T = unknown>(
  page: Page,
  path: string,
  json: unknown
): Promise<T> {
  const body = await page.evaluate(
    async ([path, json]) =>
      (
        await fetch(
          `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json }))}`
        )
      ).json(),
    [path, json] as const
  );
  if (body.error) throw new Error(`${path}: ${body.error.json?.message}`);
  return body.result.data.json as T;
}

/** يجهز بيانات المركز الأساسية عبر الواجهة البرمجية (ليست موضوع الاختبار): فرع وموسم ومعلم وحلقة وطلاب. */
export async function seedCircle(page: Page, students: string[]) {
  const [center] = await trpcQuery<{ id: number }[]>(page, "centers.list", {});
  const centerId = center.id;
  await trpcMutation(page, "branches.create", {
    centerId,
    name: "الفرع الرئيسي",
  });
  const now = Date.now();
  await trpcMutation(
    page,
    "seasons.create",
    {
      centerId,
      name: "العام الدراسي",
      type: "academic_year",
      startDate: new Date(now - 30 * 864e5).toISOString(),
      endDate: new Date(now + 300 * 864e5).toISOString(),
    },
    ["startDate", "endDate"]
  );
  await trpcMutation(page, "teachers.create", { centerId, name: "الشيخ خالد" });
  const [branch] = await trpcQuery<{ id: number }[]>(page, "branches.list", {
    centerId,
  });
  const [season] = await trpcQuery<{ id: number }[]>(page, "seasons.list", {
    centerId,
  });
  await trpcMutation(page, "circles.create", {
    branchId: branch.id,
    seasonId: season.id,
    name: "حلقة أبي بكر",
  });
  const [circle] = await trpcQuery<{ id: number }[]>(page, "circles.list", {
    branchId: branch.id,
  });
  for (const name of students)
    await trpcMutation(page, "students.create", { circleId: circle.id, name });
  return { centerId, circleId: circle.id };
}
