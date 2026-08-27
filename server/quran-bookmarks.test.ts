import { describe, expect, it } from "vitest";
import { getQuranBookmarkReferenceKey } from "../shared/quranBookmarks";

describe("العلامات المرجعية للمصحف", () => {
  it("ينشئ مراجع مستقرة للصفحات والآيات", () => {
    expect(getQuranBookmarkReferenceKey({ referenceType: "page", pageNumber: 604 })).toBe("page:604");
    expect(getQuranBookmarkReferenceKey({ referenceType: "ayah", pageNumber: 2, surahNumber: 2, ayahNumber: 255 })).toBe("ayah:2:255");
  });

  it("يرفض أرقام الصفحات والآيات الخارجة عن المصحف", () => {
    expect(() => getQuranBookmarkReferenceKey({ referenceType: "page", pageNumber: 605 })).toThrow("رقم الصفحة غير صحيح");
    expect(() => getQuranBookmarkReferenceKey({ referenceType: "ayah", pageNumber: 604, surahNumber: 1, ayahNumber: 8 })).toThrow("مرجع الآية غير صحيح");
  });
});
