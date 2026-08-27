import { parseQuranReadingProgress, QURAN_READER_PROGRESS_KEY, type QuranReadingProgress } from "../../../shared/quranReadingProgress";

export function loadQuranReadingProgress(): QuranReadingProgress | null {
  try { return parseQuranReadingProgress(window.localStorage.getItem(QURAN_READER_PROGRESS_KEY)); } catch { return null; }
}

export function saveQuranReadingProgress(page: number, verse?: Pick<QuranReadingProgress, "surah" | "ayah">) {
  if (!Number.isInteger(page) || page < 1 || page > 604) return;
  const hasValidVerse = Number.isInteger(verse?.surah) && (verse?.surah ?? 0) >= 1 && (verse?.surah ?? 115) <= 114 && Number.isInteger(verse?.ayah) && (verse?.ayah ?? 0) >= 1;
  try { window.localStorage.setItem(QURAN_READER_PROGRESS_KEY, JSON.stringify({ page, updatedAt: Date.now(), ...(hasValidVerse ? { surah: verse?.surah, ayah: verse?.ayah } : {}) } satisfies QuranReadingProgress)); } catch {}
}
