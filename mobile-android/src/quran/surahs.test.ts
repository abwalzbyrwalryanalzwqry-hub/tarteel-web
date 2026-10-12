import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-asset", () => ({ Asset: { fromModule: vi.fn() } }));
vi.mock("expo-file-system/legacy", () => ({ EncodingType: { UTF8: "utf8" } }));
import { parseLocalQuran } from "./localQuran";
import { SURAH_NAMES, stripBasmala, toArabicDigits } from "./surahs";

const verses = parseLocalQuran(readFileSync(path.join(__dirname, "../../assets/quran/tanzil-uthmani.txt"), "utf8"));

describe("المصحف المحلي", () => {
  it("يحوي 114 سورة و6236 آية", () => {
    expect(SURAH_NAMES).toHaveLength(114);
    expect(new Set(verses.map((v) => v.surah)).size).toBe(114);
    expect(verses).toHaveLength(6236);
  });

  it("يزيل البسملة من أول آية في كل السور عدا الفاتحة والتوبة", () => {
    const firsts = verses.filter((v) => v.ayah === 1);
    for (const v of firsts) {
      const stripped = stripBasmala(v.surah, v.ayah, v.text);
      if (v.surah === 1 || v.surah === 9) expect(stripped).toBe(v.text);
      else {
        expect(stripped.startsWith("ب") && stripped.includes("ٱللَّهِ ٱلرَّحْمَٰنِ")).toBe(false);
        expect(stripped.length).toBeGreaterThan(0);
      }
    }
    expect(stripBasmala(2, 1, firsts[1].text)).toBe("الٓمٓ");
  });

  it("يحوّل الأرقام إلى الهندية", () => {
    expect(toArabicDigits(286)).toBe("٢٨٦");
  });
});
