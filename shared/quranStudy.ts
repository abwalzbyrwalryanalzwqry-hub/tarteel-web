export const QURAN_STUDY_PAGE_COUNT = 604;

export type QuranWordMeaning = { number: number; word: string; meaning: string | null };
export type QuranStudyVerse = { tafsir: string; translation: string; words: QuranWordMeaning[] };
export type QuranStudyPage = { page: number; attribution: string; license: string; verses: Record<string, QuranStudyVerse> };

const isVerseReference = (reference: string) => {
  const [surah, ayah, extra] = reference.split(":");
  return !extra && Number.isInteger(Number(surah)) && Number(surah) >= 1 && Number(surah) <= 114 && Number.isInteger(Number(ayah)) && Number(ayah) >= 1;
};

export function validateQuranStudyPage(data: unknown, expectedPage?: number): data is QuranStudyPage {
  if (!data || typeof data !== "object") return false;
  const page = data as Partial<QuranStudyPage>;
  if (!Number.isInteger(page.page) || page.page! < 1 || page.page! > QURAN_STUDY_PAGE_COUNT || (expectedPage !== undefined && page.page !== expectedPage)) return false;
  if (typeof page.attribution !== "string" || !page.attribution.trim() || typeof page.license !== "string" || !page.license.trim() || !page.verses || typeof page.verses !== "object") return false;
  return Object.entries(page.verses).every(([reference, verse]) => isVerseReference(reference) && Boolean(verse) && typeof verse.tafsir === "string" && typeof verse.translation === "string" && Array.isArray(verse.words) && verse.words.every((word) => Number.isInteger(word.number) && word.number > 0 && typeof word.word === "string" && Boolean(word.word.trim()) && (typeof word.meaning === "string" || word.meaning === null)));
}
