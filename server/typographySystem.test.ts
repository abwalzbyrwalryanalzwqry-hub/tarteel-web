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
});
