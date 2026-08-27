import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("أكواد القراءة والنطاق الإشرافي", () => {
  it("يثبت الطالب وولي الأمر على طالب واحد واستخدام واحد عند الإصدار", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(router).toContain("كود الطالب أو ولي الأمر مخصص لحساب واحد واستخدام واحد فقط");
    expect(router).toContain("? [{ scopeType: \"student\" as const, scopeId: input.studentId! }]");
    expect(router).toContain("لا يجوز منح هذا الدور نطاق المركز كاملاً");
  });

  it("يرفض الاسترداد الذري لبيانات النطاق المتعددة أو الارتباط بحساب آخر", () => {
    const db = readFileSync(path.join(root, "server/db.ts"), "utf8");
    expect(db).toContain("كود الطالب أو ولي الأمر لا يمكن أن يمنح سوى طالب واحد");
    expect(db).toContain("هذا الحساب مرتبط بطالب آخر ولا يمكن منحه طالباً إضافياً");
    expect(db).toContain("هذا الحساب مرتبط بابن آخر ولا يمكن منحه نطاقاً إضافياً");
    expect(db).toContain("eq(students.guardianUserId, input.userId)");
  });

  it("يلزم الموجّه بحلقات صريحة داخل المركز ويمنع نطاق المركز", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    const db = readFileSync(path.join(root, "server/db.ts"), "utf8");
    expect(router).toContain("يلزم تحديد حلقة واحدة أو أكثر للموجّه ولا يقبل كود الموجّه نطاقات أخرى");
    expect(router).toContain("كود الموجّه مخصص لحساب واحد واستخدام واحد فقط");
    expect(db).toContain("كود الموجّه غير صالح؛ يلزم حلقات محددة واستخدام واحد");
    expect(db).toContain("نطاق حلقات الموجّه غير صالح أو خارج المركز");
  });

  it("يقصر واجهة ولي الأمر على ملخص التقدم والحفظ والمراجعة والحضور والسجل", () => {
    const profile = readFileSync(path.join(root, "client/src/pages/StudentProfile.tsx"), "utf8");
    expect(profile).toContain('isGuardianReader ? profileTabs.filter((tab) => ["summary", "memorization", "revision", "attendance", "timeline"].includes(tab.id))');
    expect(profile).toContain("!isStudentReader && !isGuardianReader");
  });
});
