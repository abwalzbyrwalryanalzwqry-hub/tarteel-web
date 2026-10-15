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

  it("يدعم نهاري وليلي وحسب الجهاز، ويطبّق السمة قبل أول رسم دون سكربت مضمّن", () => {
    const themeSource = readFileSync(path.join(projectRoot, "client/src/contexts/ThemeContext.tsx"), "utf8");
    const settingsSource = readFileSync(path.join(projectRoot, "client/src/pages/Settings.tsx"), "utf8");
    const html = readFileSync(path.join(projectRoot, "client/index.html"), "utf8");
    const init = readFileSync(path.join(projectRoot, "client/public/theme-init.js"), "utf8");

    expect(themeSource).toContain('type Theme = "light" | "dark"');
    expect(themeSource).toContain('export type ThemePreference = Theme | "system"');
    expect(themeSource).toContain("prefers-color-scheme: dark");
    expect(settingsSource).toContain("حسب الجهاز");
    // CSP: script-src 'self' — ملف خارجي في <head> لا سكربت مضمّن.
    expect(html).toMatch(/<head>[\s\S]*<script src="\/theme-init\.js"><\/script>[\s\S]*<\/head>/);
    expect(html).not.toMatch(/<script>(?!<\/script>)/);
    expect(init).toContain('localStorage.getItem("theme")');
  });

  it("الألوان الدلالية تتغير فعلاً في الوضع الليلي (ليست داخل @theme inline)", () => {
    const css = readFileSync(path.join(projectRoot, "client/src/index.css"), "utf8");
    // ‎@theme inline‎ ينسخ القيمة الفاتحة في كل صنف (bg-background…) فلا يغيّرها ‎.dark‎ — كان سبب
    // بقاء الخلفيات فاتحة والنصوص الفاتحة عليها في الوضع الليلي.
    const inlineBlocks = css.match(/@theme inline\s*\{[^}]*\}/g) ?? [];
    for (const block of inlineBlocks) expect(block).not.toMatch(/--color-(background|foreground|card|muted|primary|border|input|popover)\b/);
    expect(css).toMatch(/@theme\s*\{[^}]*--color-background:/);
    const dark = /\.dark\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    for (const token of ["background", "foreground", "card", "card-foreground", "popover", "muted", "muted-foreground", "primary", "primary-foreground", "border", "input", "ring"])
      expect(dark).toContain(`--color-${token}:`);
    expect(dark).toContain("color-scheme: dark");
  });

  it("يوفر تفضيل حجم الخط ويحفظه محلياً ويعرضه في الإعدادات", () => {
    const themeSource = readFileSync(path.join(projectRoot, "client/src/contexts/ThemeContext.tsx"), "utf8");
    const settingsSource = readFileSync(path.join(projectRoot, "client/src/pages/Settings.tsx"), "utf8");

    expect(themeSource).toContain('type FontScale = "small" | "standard" | "large"');
    expect(themeSource).toContain('localStorage.setItem("fontScale", fontScale)');
    expect(themeSource).toContain("document.documentElement.dataset.fontScale = fontScale");
    expect(settingsSource).toContain("حجم الخط");
  });
});
