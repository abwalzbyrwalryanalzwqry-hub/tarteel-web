import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSION_TEMPLATES } from "./accessControl";
import { readRouterSource } from "./testing/routerSource";

const root = process.cwd();

describe("إدارة المعلم لحلقته", () => {
  it("يمنح المعلم حذف الطالب ضمن القالب التفصيلي فقط", () => {
    expect(ROLE_PERMISSION_TEMPLATES.teacher).toContain("students.create");
    expect(ROLE_PERMISSION_TEMPLATES.teacher).toContain("students.edit");
    expect(ROLE_PERMISSION_TEMPLATES.teacher).toContain("students.delete");
    expect(ROLE_PERMISSION_TEMPLATES.teacher).not.toContain("students.transfer");
  });

  it("يفرض الحلقة على إنشاء الطالب للمعلم ويمنع تجاوز مركز الحلقة", () => {
    const router = readRouterSource();
    expect(router).toContain("يلزم ربط الطالب بحلقة المعلم عند الإنشاء أو الإدارة");
    expect(router).toContain("الحلقة لا تنتمي إلى المركز المحدد");
    expect(router).toContain("assertStudentManageAccess(ctx.user, input.circleId, \"students.create\"");
  });

  it("يحصر الكتابة في السجل اليومي على من يملك التحضير في الحلقة نفسها", () => {
    const daily = readFileSync(path.join(root, "server/routers/daily.ts"), "utf8").replace(/\s+/g, " ");
    expect(daily).toContain('assertCirclePermission(user, circleId, "attendance.view")');
    expect(daily).toContain('assertCirclePermission(user, circleId, "attendance.create")');
    expect(daily).toContain("if (!access.editor) throw new DailyError(\"NOT_YOUR_HALAQA\")");
  });

  it("يقصر بيانات التقارير على صلاحية التصدير داخل نطاق الحلقة", () => {
    const daily = readFileSync(path.join(root, "server/routers/daily.ts"), "utf8").replace(/\s+/g, " ");
    expect(daily).toContain('assertCirclePermission(user, circleId, "reports.export")');
    expect(daily).toContain("await reportAccess(ctx.user, input.halaqa)");
  });
});
