import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("توافق ثيم قسم عن المطور", () => {
  it("يستخدم ألواناً دلالية متوافقة مع Light وDark Mode", () => {
    const source = readFileSync(path.join(projectRoot, "client/src/pages/DeveloperInfo.tsx"), "utf8");

    expect(source).toContain("text-foreground");
    expect(source).toContain("text-muted-foreground");
    expect(source).toContain("bg-card");
    expect(source).toContain("border-border");
    expect(source).not.toContain("bg-white");
  });

  it("يوثق أن التطبيق يدعم Light وDark فقط ولا يفعّل System Mode حالياً", () => {
    const themeSource = readFileSync(path.join(projectRoot, "client/src/contexts/ThemeContext.tsx"), "utf8");

    expect(themeSource).toContain('type Theme = "light" | "dark"');
    expect(themeSource).not.toContain('"system"');
  });
});
