import { describe, expect, it } from "vitest";
import { createAccessCodeSecret, getAccessCodeHint, hashAccessCode, normalizeAccessCode } from "./accessCodeSecurity";
import { ROLE_PERMISSION_TEMPLATES } from "./accessControl";
import { accessCodes, centerMemberships, permissionGrants, userScopes } from "../drizzle/schema";
import { readFileSync } from "node:fs";

describe("منظومة التحكم في الوصول", () => {
  it("ينشئ كوداً عشوائياً مهيأ للمشاركة ولا يعيد secret من تلميحه أو hash", () => {
    const first = createAccessCodeSecret();
    const second = createAccessCodeSecret();
    expect(first).toMatch(/^TRT-[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/);
    expect(first).not.toBe(second);
    expect(normalizeAccessCode(` ${first.toLowerCase()} `)).toBe(first);
    expect(hashAccessCode(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(getAccessCodeHint(first)).toBe(`••••${first.slice(-4)}`);
    expect(getAccessCodeHint(first)).not.toContain(first.slice(0, 8));
  });

  it("يفصل قوالب المدير والموجه والمعلم والقراءة المحدودة عن بعضها", () => {
    expect(ROLE_PERMISSION_TEMPLATES.center_manager).toContain("users.edit");
    expect(ROLE_PERMISSION_TEMPLATES.supervisor).toContain("students.transfer");
    expect(ROLE_PERMISSION_TEMPLATES.guide).toContain("reports.view");
    expect(ROLE_PERMISSION_TEMPLATES.guide).not.toContain("students.edit");
    expect(ROLE_PERMISSION_TEMPLATES.teacher).toContain("access_codes.create");
    expect(ROLE_PERMISSION_TEMPLATES.student).not.toContain("attendance.edit");
    expect(ROLE_PERMISSION_TEMPLATES.guardian).not.toContain("access_codes.create");
  });

  it("يحفظ الركائز الأمنية كجداول مستقلة لا كإخفاء واجهة أو حقل دور عام", () => {
    expect(Object.keys(centerMemberships)).toContain("centerId");
    expect(Object.keys(permissionGrants)).toContain("grantedBy");
    expect(Object.keys(userScopes)).toContain("scopeType");
    expect(Object.keys(accessCodes)).toContain("codeHash");
    expect(Object.keys(accessCodes)).not.toContain("code");
  });

  it("يربط إعادة الإصدار بإبطال الكود السابق وتدقيقه، ولا يكشف hash في قائمة الأكواد", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(router).toContain("reissue: protectedProcedure");
    expect(router).toContain("if (previous.status === \"active\") await revokeAccessCode(previous.id)");
    expect(router).toContain("access.code.reissue");
    expect(router).toContain("({ codeHash: _codeHash, ...code })");
  });
});
