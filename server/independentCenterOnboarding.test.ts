import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("مسار المدير الجديد والمركز المستقل", () => {
  it("ينشئ المركز ومنظمته وعضوية المالك والنطاق ضمن معاملة واحدة", () => {
    const database = read("server/db.ts");
    expect(database).toContain("provisionIndependentCenter");
    expect(database).toContain("db.transaction");
    expect(database).toContain('role: "center_manager"');
    expect(database).toContain("isOwner: true");
    expect(database).toContain('scopeType: "center"');
    expect(database).toContain("الحساب مفعّل بالفعل في مركز قائم");
  });

  it("يعرض للحساب الجديد اختيار إنشاء مركز أو الانضمام بكود ولا يفرض استرداد الكود", () => {
    const login = read("client/src/pages/LoginPage.tsx");
    const layout = read("client/src/components/TarteelLayout.tsx");
    const onboarding = read("client/src/pages/CenterOnboarding.tsx");
    const router = read("server/routers.ts");
    const app = read("client/src/App.tsx");
    expect(login).toContain('"/start"');
    expect(layout).toContain('navigate("/start")');
    expect(onboarding).toContain("إنشاء مركز جديد");
    expect(onboarding).toContain("الانضمام إلى مركز قائم");
    expect(onboarding).toContain("تم إنشاء مركزك بنجاح");
    expect(onboarding).toContain("إعداد الحلقة الأولى");
    expect(onboarding).toContain('navigate("/circles")');
    expect(onboarding).toContain('navigate("/dashboard")');
    expect(router).toContain("createIndependentCenter");
    expect(app).toContain('path="/start"');
  });
});
