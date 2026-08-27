import { QURAN_SURAHS } from "./types";

export type QuranBookmarkReference = {
  referenceType: "page" | "ayah";
  pageNumber: number;
  surahNumber?: number;
  ayahNumber?: number;
};

export function getQuranBookmarkReferenceKey(input: QuranBookmarkReference) {
  if (!Number.isInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > 604) throw new Error("رقم الصفحة غير صحيح.");
  if (input.referenceType === "page") return `page:${input.pageNumber}`;
  const surah = QURAN_SURAHS.find((item) => item.number === input.surahNumber);
  if (!surah || !Number.isInteger(input.ayahNumber) || !input.ayahNumber || input.ayahNumber > surah.ayahs) throw new Error("مرجع الآية غير صحيح.");
  return `ayah:${surah.number}:${input.ayahNumber}`;
}
