import { parseQuranReadingProgress } from "../shared/quranReadingProgress";
import { describe, expect, it } from "vitest";

describe("تقدم القراءة في المصحف", () => {
  it("يقرأ موضعاً محفوظاً حديثاً أو قيمة الصفحة القديمة للتوافق", () => {
    expect(parseQuranReadingProgress(JSON.stringify({ page: 583, updatedAt: 1234 }))).toEqual({ page: 583, updatedAt: 1234 });
    expect(parseQuranReadingProgress(JSON.stringify({ page: 322, updatedAt: 5678, surah: 21, ayah: 5 }))).toEqual({ page: 322, updatedAt: 5678, surah: 21, ayah: 5 });
    expect(parseQuranReadingProgress("17")).toEqual({ page: 17, updatedAt: 0 });
  });

  it("يرفض الموضع الناقص أو الخارج عن صفحات المصحف", () => {
    expect(parseQuranReadingProgress(JSON.stringify({ page: 605, updatedAt: 1234 }))).toBeNull();
    expect(parseQuranReadingProgress(JSON.stringify({ page: 2 }))).toBeNull();
    expect(parseQuranReadingProgress(JSON.stringify({ page: 2, updatedAt: 1234, surah: 115, ayah: 1 }))).toEqual({ page: 2, updatedAt: 1234 });
    expect(parseQuranReadingProgress("نص غير صالح")).toBeNull();
  });
});
