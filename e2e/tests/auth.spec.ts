import { expect, test } from "@playwright/test";
import { PASSWORD, loginViaUi, registerViaUi, uniqueEmail } from "./helpers";

test.describe("الدخول", () => {
  test("إنشاء حساب ثم خروج ثم دخول؛ وكلمة المرور الخاطئة تُرفض برسالة عربية", async ({
    page,
    context,
  }) => {
    const email = uniqueEmail("auth");
    await registerViaUi(page, "مستخدم الدخول", email);
    await expect(page).toHaveURL(/\/start/);
    expect(
      (await context.cookies()).some(
        cookie => cookie.httpOnly && cookie.name.length > 0
      )
    ).toBe(true);

    await context.clearCookies();
    await loginViaUi(page, email, "Wrong9999");
    await expect(
      page.getByText("البريد أو كلمة المرور غير صحيحة")
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await loginViaUi(page, email, PASSWORD);
    await page.waitForURL(url => !url.pathname.startsWith("/login"));
    const me = await page.evaluate(
      async () =>
        (await (await fetch("/api/trpc/auth.me")).json()).result.data.json
    );
    expect(me).toMatchObject({ email, name: "مستخدم الدخول" });
  });

  test("إنشاء حساب برقم الهاتف ثم الدخول بالرقم بصيغة أخرى", async ({
    page,
    context,
  }) => {
    const local = `7${String(Date.now()).slice(-8)}`;
    await page.goto("/login");
    await page.getByRole("tab", { name: "حساب جديد" }).click();
    await page.getByRole("radio", { name: "برقم الهاتف" }).click();
    await page.getByLabel("الاسم الكامل").fill("مستخدم الهاتف");
    await page.getByLabel("رقم الهاتف").fill(`0${local}`);
    await page.getByLabel("كلمة المرور").fill(PASSWORD);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(url => !url.pathname.startsWith("/login"));

    await context.clearCookies();
    await loginViaUi(page, `+967 ${local}`, "Wrong9999");
    await expect(
      page.getByText("رقم الهاتف أو كلمة المرور غير صحيحة")
    ).toBeVisible();

    await loginViaUi(page, `+967 ${local}`, PASSWORD);
    await page.waitForURL(url => !url.pathname.startsWith("/login"));
    const me = await page.evaluate(
      async () =>
        (await (await fetch("/api/trpc/auth.me")).json()).result.data.json
    );
    expect(me).toMatchObject({ phone: `+967${local}`, name: "مستخدم الهاتف" });
  });

  test("الصفحات المحمية تعيد غير المسجّل إلى الدخول", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("tab", { name: "تسجيل الدخول" })).toBeVisible();
  });
});
