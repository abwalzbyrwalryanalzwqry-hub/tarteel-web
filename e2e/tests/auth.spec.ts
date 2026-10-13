import { expect, test } from "@playwright/test";
import { PASSWORD, loginViaUi, registerViaUi, uniqueEmail } from "./helpers";

test.describe("الدخول", () => {
  test("إنشاء حساب ثم خروج ثم دخول؛ وكلمة المرور الخاطئة تُرفض برسالة عربية", async ({ page, context }) => {
    const email = uniqueEmail("auth");
    await registerViaUi(page, "مستخدم الدخول", email);
    await expect(page).toHaveURL(/\/start/);
    expect((await context.cookies()).some((cookie) => cookie.httpOnly && cookie.name.length > 0)).toBe(true);

    await context.clearCookies();
    await loginViaUi(page, email, "Wrong9999");
    await expect(page.getByText("البريد أو كلمة المرور غير صحيحة")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await loginViaUi(page, email, PASSWORD);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    const me = await page.evaluate(async () => (await (await fetch("/api/trpc/auth.me")).json()).result.data.json);
    expect(me).toMatchObject({ email, name: "مستخدم الدخول" });
  });

  test("الصفحات المحمية تعيد غير المسجّل إلى الدخول", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("tab", { name: "تسجيل الدخول" })).toBeVisible();
  });
});
