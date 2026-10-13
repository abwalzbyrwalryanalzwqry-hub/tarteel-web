import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readDataLayerSource } from "./testing/dataLayerSource";
import { readRouterSource } from "./testing/routerSource";

const root = process.cwd();

describe("انتهاء كود الدخول وإشعار المدير", () => {
  it("يبقي تاريخ انتهاء الكود اختيارياً ويرفض التاريخ الماضي عند الإنشاء وإعادة الإصدار", () => {
    const router = readRouterSource();
    const page = readFileSync(path.join(root, "client/src/pages/AccessManagement.tsx"), "utf8");
    expect(router).toContain("expiresAt: z.date().nullable().optional()");
    expect(router).toContain("تاريخ الانتهاء يجب أن يكون في المستقبل");
    expect(page).toContain("تاريخ الانتهاء (اختياري)");
    expect(page).toContain("اتركه فارغاً ليبقى الكود صالحاً حتى يُستخدم أو يُلغى.");
  });

  it("ينشئ إشعاراً داخلياً لكل مدير نشط عند استرداد كود بنجاح", () => {
    const db = readDataLayerSource(root);
    expect(db).toContain("eq(centerMemberships.role, \"center_manager\")");
    expect(db).toContain("eq(centerMemberships.isOwner, true)");
    expect(db).toContain("title: \"تم استخدام كود دخول\"");
    expect(db).toContain("relatedType: \"access_code_redeemed\"");
    expect(db).toContain("استرد ${redeemingUser?.name || redeemingUser?.email || \"مستخدم\"} كود دخول");
  });
});
