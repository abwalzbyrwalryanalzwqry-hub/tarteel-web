import { parseQuranReadingProgress, QURAN_READER_PROGRESS_KEY, type QuranReadingProgress } from "../../../shared/quranReadingProgress";

export function loadQuranReadingProgress(): QuranReadingProgress | null {
  try { return parseQuranReadingProgress(window.localStorage.getItem(QURAN_READER_PROGRESS_KEY)); } catch { return null; }
}

export function saveQuranReadingProgress(page: number) {
  if (!Number.isInteger(page) || page < 1 || page > 604) return;
  try { window.localStorage.setItem(QURAN_READER_PROGRESS_KEY, JSON.stringify({ page, updatedAt: Date.now() } satisfies QuranReadingProgress)); } catch {}
}
