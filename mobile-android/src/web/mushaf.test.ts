import { describe, expect, it } from "vitest";
import { mushafStartUrl, parseLegacyLastRead } from "./mushaf";

describe("تبويب المصحف", () => {
  it("يفتح المصحف المستقل من نسخة الجهاز", () => {
    expect(mushafStartUrl(null)).toBe("https://appassets.androidplatform.net/quran?app=reader");
  });

  it("ينقل آخر موضع من القارئ السابق مرة واحدة", () => {
    const legacy = parseLegacyLastRead(JSON.stringify({ surah: 18, ayah: 10 }));
    expect(legacy).toEqual({ surah: 18, ayah: 10 });
    expect(mushafStartUrl(legacy)).toBe(
      "https://appassets.androidplatform.net/quran/read?surah=18&ayah=10&app=reader",
    );
  });

  it("يتجاهل موضعاً تالفاً أو خارج المصحف", () => {
    expect(parseLegacyLastRead(null)).toBeNull();
    expect(parseLegacyLastRead("{")).toBeNull();
    expect(parseLegacyLastRead(JSON.stringify({ surah: 115, ayah: 1 }))).toBeNull();
    expect(parseLegacyLastRead(JSON.stringify({ surah: 2, ayah: 0 }))).toBeNull();
  });
});
