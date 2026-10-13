import { expect, test } from "@playwright/test";
import {
  PASSWORD,
  createCenterViaUi,
  loginViaUi,
  registerViaUi,
  uniqueEmail,
} from "./helpers";

test.describe("الخصوصية وحذف الحساب", () => {
  test("الصفحات العامة تُفتح دون دخول، وروابطها في صفحة الدخول", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "سياسة الخصوصية" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "سياسة الخصوصية" })
    ).toBeVisible();
    await expect(page.getByText("البيانات التي نجمعها")).toBeVisible();

    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { level: 1, name: "شروط الاستخدام" })
    ).toBeVisible();

    await page.goto("/delete-account");
    await expect(
      page.getByRole("heading", { level: 1, name: "حذف حسابك في ترتيل" })
    ).toBeVisible();
    await expect(page.getByText("ما يُحذف", { exact: true })).toBeVisible();
  });

  test("حساب جديد بلا مركز يحذف نفسه من صفحة البداية ثم لا يستطيع الدخول", async ({
    page,
  }) => {
    const email = uniqueEmail("delete");
    await registerViaUi(page, "مستخدم للحذف", email);

    await page.goto("/start");
    await page.getByRole("link", { name: "حذف الحساب" }).click();
    await expect(page).toHaveURL(/\/delete-account$/);
    await page.getByRole("button", { name: "حذف حسابي…" }).click();
    const submit = page.getByRole("button", { name: "حذف حسابي نهائياً" });
    await expect(submit).toBeDisabled();
    await page.getByLabel(/للتأكيد/).fill("احذف حسابي");
    await page.getByLabel("كلمة المرور", { exact: true }).last().fill(PASSWORD);
    await submit.click();
    await page.waitForURL(/\/login/);

    await loginViaUi(page, email);
    await expect(
      page.getByText("البريد أو كلمة المرور غير صحيحة")
    ).toBeVisible();
  });

  test("المدير الوحيد لمركز يُطلب منه إضافة مدير قبل الحذف", async ({
    page,
  }) => {
    await registerViaUi(page, "مدير وحيد", uniqueEmail("owner"));
    await createCenterViaUi(page, `مركز الحذف ${Date.now()}`);
    await page.goto("/settings");
    await expect(page.getByText(/أنت المدير الوحيد/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "سياسة الخصوصية" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "حذف حسابي…" })).toHaveCount(
      0
    );
  });
});
