import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("إدارة المعلم وعزل البيانات", () => {
  it("يوفر نقل المعلم مع منع نقله خارج مركزه أو إلى مقعد مشغول", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    const db = readFileSync(path.join(root, "server/db.ts"), "utf8");
    expect(router).toContain("transferTeacherToCircle");
    expect(router).toContain("branch.centerId !== teacher.centerId");
    expect(db).toContain("المقعد المحدد في الحَلَقة مرتبط بمعلم آخر");
    expect(db).toContain("getTeacherLastActivity");
    expect(db).toContain("circles.assistantTeacherId");
  });

  it("يربط سجل الطالب بحساب الطالب وولي الأمر ويمنع القراءة خارج الارتباط", () => {
    const schema = readFileSync(path.join(root, "drizzle/schema.ts"), "utf8");
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(schema).toContain('guardianUserId: int("guardianUserId")');
    expect(router).toContain("getStudentsByGuardianUserId");
    expect(router).toContain("student.userId !== user.id");
    expect(router).toContain("student.guardianUserId !== user.id");
    expect(router).toContain("const scope = await getTeacherCircleScope(ctx.user)");
  });
});
