import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("كود المعلم للحلقة الواحدة", () => {
  it("يفرض حلقة محددة واستخداماً واحداً عند إصدار الكود", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(router).toContain("يلزم ربط كود المعلم بحلقة واحدة محددة");
    expect(router).toContain("كود المعلم مخصص لمعلم واحد واستخدام واحد فقط");
    expect(router).toMatch(/const codeScopes = isTeacherCode\s*\? \[\{ scopeType: "circle"/);
    expect(router).toContain("maxUses: isTeacherCode || isReaderCode || isGuideCode ? 1 : input.maxUses");
  });

  it("يرفض نطاقاً ثانياً للمعلم عند التعديل أو الاسترداد", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    const db = readFileSync(path.join(root, "server/db.ts"), "utf8");
    expect(router).toContain("تفويض المعلم يجب أن يقتصر على حلقة واحدة فقط");
    expect(db).toContain("كود المعلم لا يمكن أن يمنح سوى نطاق الحلقة المعينة");
    expect(db).toContain("هذا الحساب مرتبط بحلقة معلم أخرى ولا يمكن منحه حلقة إضافية");
    expect(db).toContain("eq(userScopes.userId, input.userId)");
  });

  it("يحمي تدفق دعوة المعلم القديم من إعادة استخدام ملف المعلم في حلقة أخرى", () => {
    const db = readFileSync(path.join(root, "server/db.ts"), "utf8");
    expect(db).toContain("existingTeacherCircles.some((circle) => circle.id !== invite.circleId)");
  });
});
