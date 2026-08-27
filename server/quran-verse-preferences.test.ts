import { describe, expect, it } from "vitest";
import { normalizeQuranVersePreference } from "../shared/quranVersePreferences";

describe("تفضيلات آيات المصحف", () => {
  it("تنشئ مفتاحاً ثابتاً للمفضلة أو الملاحظة وتزيل الفراغات غير المفيدة", () => {
    expect(normalizeQuranVersePreference({ pageNumber: 2, surahNumber: 2, ayahNumber: 255, isFavorite: true, note: "  مراجعة أسبوعية  " })).toEqual({ pageNumber: 2, surahNumber: 2, ayahNumber: 255, isFavorite: true, note: "مراجعة أسبوعية", verseKey: "ayah:2:255", shouldPersist: true });
  });

  it("لا يترك سجلاً فارغاً بعد إزالة المفضلة والملاحظة", () => {
    expect(normalizeQuranVersePreference({ pageNumber: 604, surahNumber: 114, ayahNumber: 6, isFavorite: false, note: "   " }).shouldPersist).toBe(false);
  });

  it("يرفض مرجع الآية غير الصحيح قبل أي محاولة حفظ", () => {
    expect(() => normalizeQuranVersePreference({ pageNumber: 604, surahNumber: 114, ayahNumber: 7, isFavorite: true, note: null })).toThrow("مرجع الآية غير صحيح");
  });
});
