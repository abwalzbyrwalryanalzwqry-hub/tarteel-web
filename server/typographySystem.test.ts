import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = readFileSync(path.join(root, "client/src/index.css"), "utf8");
const html = readFileSync(path.join(root, "client/index.html"), "utf8");
const mushafCss = readFileSync(path.join(root, "client/src/mushaf/mushaf.css"), "utf8");
const quranFonts = readFileSync(path.join(root, "client/public/fonts/quran-fonts.css"), "utf8");

describe("نظام خطوط ترتيل المركزي", () => {
  it("يربط ملفات ثمانية شريف الرسمية بجميع الأوزان المتاحة من التخزين المعتمد", () => {
    expect(css).toContain('font-family: "Tarteel Serif Text"');
    for (const weight of ["Light", "Regular", "Medium", "Bold", "Black"]) {
      expect(css).toContain(`/storage/thmanyahseriftext-${weight}`);
    }
    for (const weight of ["300", "400", "500", "700", "900"]) {
      expect(css).toContain(`font-weight: ${weight}`);
    }
  });

  it("يعرّف رموزاً مركزية للعرض والعناوين والنصوص والأكواد", () => {
    for (const token of ["display-lg", "display-md", "display-sm", "h1", "h2", "h3", "h4", "body-lg", "body", "body-sm", "caption", "label", "button"]) {
      expect(css).toContain(`--tarteel-type-${token}`);
    }
    expect(css).toContain(".tarteel-code, code, kbd, samp");
  });

  it("يلغي تحميل الخطوط الخارجية ويستضيف خطوط المصحف ذاتياً بهوية ترتيل", () => {
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic|Tajawal|Amiri/);
    expect(quranFonts).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    expect(quranFonts).toContain("/fonts/amiri-quran-400-arabic.woff2");
    expect(mushafCss).toContain('font-family: "KFGQPC Hafs"');
    expect(mushafCss).toContain("--font-quran:");
    expect(mushafCss).toContain('"Tarteel Serif Text"');
  });

  it("يضمّن خطوط ثمانية في تطبيق أندرويد فقط: تُجلب وقت البناء ولا تُرفع إلى المستودع ولا تُستضاف في الويب", () => {
    const fontsCss = readFileSync(path.join(root, "client/public/fonts/thmanyah/thmanyah-fonts.css"), "utf8");
    const script = readFileSync(path.join(root, "scripts/fetch-thmanyah-fonts.sh"), "utf8");
    const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");
    const vite = readFileSync(path.join(root, "vite.config.ts"), "utf8");
    const files = [
      ...["Light", "Regular", "Medium", "Bold", "Black"].map(w => `thmanyahseriftext-${w}.woff2`),
      ...["Light", "Regular", "Medium", "Bold", "Black"].map(w => `thmanyah-sans-${w}.woff2`),
      "thmanyah-serif-display-Regular.woff2",
      "thmanyah-serif-display-Bold.woff2",
    ];
    for (const file of files) {
      expect(fontsCss).toContain(`/fonts/thmanyah/${file}`);
      expect(script).toContain(file);
    }
    for (const family of ["Thmanyah Serif Text", "Thmanyah Sans", "Thmanyah Serif Display"]) expect(fontsCss).toContain(`font-family: "${family}"`);
    expect(script).toContain("manar-fonts");
    expect(script).toContain("zen-fonts");
    expect(gitignore).toContain("client/public/fonts/thmanyah/*.woff2");
    expect(vite).toContain("thmanyahDeviceFonts()");
    expect(vite).toContain('stripThmanyahFromWeb(r("dist/public"))');
    // التوزيع: النصوص Serif Text، العناوين Serif Display، عناصر التحكم Sans.
    expect(css).toMatch(/--font-body: "Thmanyah Serif Text"/);
    expect(css).toMatch(/--font-display: "Thmanyah Serif Display"/);
    expect(css).toMatch(/--font-ui: "Thmanyah Sans"/);
    expect(css).toMatch(/button, input, select, textarea[^{]*\{\s*font-family: var\(--font-ui\)/);
  });

  it("لا توجد ملفات خط ثمانية متتبَّعة في git", async () => {
    const { execFileSync } = await import("node:child_process");
    let tracked = "";
    try {
      tracked = execFileSync("git", ["ls-files", "client/public/fonts/thmanyah"], { cwd: root, encoding: "utf8" });
    } catch {
      return; // خارج مستودع git (حزمة مصدرية): لا شيء يُفحص.
    }
    expect(tracked.split("\n").filter(f => /\.(woff2?|otf|ttf)$/i.test(f))).toEqual([]);
  });
});
