export type QuranVerse = {
  surah: number;
  ayah: number;
  text: string;
};

export const TANZIL_UTHMANI_SOURCE_URL = "https://tanzil.net/download/";
export const QURAN_TEXT_ASSET_URL = "/manus-storage/tanzil-uthmani_6fa64a0a.txt";
const CACHE_KEY = "tarteel:quran:uthmani:v1";

export function parseTanzilUthmaniText(raw: string): QuranVerse[] {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const [surah, ayah, ...content] = line.split("|");
      return { surah: Number(surah), ayah: Number(ayah), text: content.join("|").trim() };
    })
    .filter((verse) => Number.isInteger(verse.surah) && Number.isInteger(verse.ayah) && Boolean(verse.text));
}

export function normalizeQuranSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ٱ/g, "ا")
    .replace(/ى/g, "ي")
    .trim();
}

export function searchQuranVerses(verses: QuranVerse[], query: string, limit = 60): QuranVerse[] {
  const normalizedQuery = normalizeQuranSearch(query);
  if (!normalizedQuery) return [];
  return verses
    .filter((verse) => normalizeQuranSearch(verse.text).includes(normalizedQuery))
    .slice(0, limit);
}

export async function loadQuranVerses(): Promise<QuranVerse[]> {
  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) return parseTanzilUthmaniText(cached);
  } catch {
    // يعمل القارئ دون تخزين مؤقت عند حظر المتصفح للتخزين المحلي.
  }

  const response = await fetch(QURAN_TEXT_ASSET_URL);
  if (!response.ok) throw new Error("تعذر تحميل النص العثماني");
  const raw = await response.text();

  try {
    window.localStorage.setItem(CACHE_KEY, raw);
  } catch {
    // لا يؤثر فشل التخزين المؤقت في القراءة الحالية.
  }

  return parseTanzilUthmaniText(raw);
}
