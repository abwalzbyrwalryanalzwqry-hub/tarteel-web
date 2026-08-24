import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSION_TEMPLATES } from "./accessControl";

const root = process.cwd();

describe("إدارة المعلم لحلقته", () => {
  it("يمنح المعلم حذف الطالب ضمن القالب التفصيلي فقط", () => {
    expect(ROLE_PERMISSION_TEMPLATES.teacher).toContain("students.create");
    expect(ROLE_PERMISSION_TEMPLATES.teacher).toContain("students.edit");
    expect(ROLE_PERMISSION_TEMPLATES.teacher).toContain("students.delete");
    expect(ROLE_PERMISSION_TEMPLATES.teacher).not.toContain("students.transfer");
  });

  it("يفرض الحلقة على إنشاء الطالب للمعلم ويمنع تجاوز مركز الحلقة", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(router).toContain("يلزم ربط الطالب بحلقة المعلم عند الإنشاء أو الإدارة");
    expect(router).toContain("الحلقة لا تنتمي إلى المركز المحدد");
    expect(router).toContain("assertStudentManageAccess(ctx.user, input.circleId, \"students.create\"");
  });

  it("يثبت معلم الجلسة وموسمها على الحلقة المرتبطة بحسابه", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(router).toContain("resolveSessionCreateInput");
    expect(router).toContain("circle.teacherId !== teacher.id && circle.assistantTeacherId !== teacher.id");
    expect(router).toContain("لا يمكنك تعيين معلم آخر لجلسة حلقتك");
    expect(router).toContain("الموسم المحدد لا يطابق موسم الحلقة");
    expect(router).toContain("sessions: router");
  });

  it("يفصل معاينة التقرير عن تصديره بصلاحية التصدير داخل نطاق الحلقة", () => {
    const reporting = readFileSync(path.join(root, "server/routers/reporting.ts"), "utf8");
    expect(reporting).toContain('assertReportScope(ctx.user, input.circleId, "reports.export")');
  });
});
