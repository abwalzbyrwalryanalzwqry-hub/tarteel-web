export const QURAN_READER_PROGRESS_KEY = "tarteel-quran-reader-last-page";

export interface QuranReadingProgress {
  page: number;
  updatedAt: number;
  surah?: number;
  ayah?: number;
}

export function parseQuranReadingProgress(raw: string | null): QuranReadingProgress | null {
  if (!raw) return null;
  const legacyPage = Number(raw);
  if (Number.isInteger(legacyPage) && legacyPage >= 1 && legacyPage <= 604) return { page: legacyPage, updatedAt: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<QuranReadingProgress>;
    if (!Number.isInteger(parsed.page) || parsed.page! < 1 || parsed.page! > 604 || !Number.isFinite(parsed.updatedAt)) return null;
    const hasValidVerse = Number.isInteger(parsed.surah) && parsed.surah! >= 1 && parsed.surah! <= 114 && Number.isInteger(parsed.ayah) && parsed.ayah! >= 1;
    return { page: parsed.page!, updatedAt: parsed.updatedAt!, ...(hasValidVerse ? { surah: parsed.surah!, ayah: parsed.ayah! } : {}) };
  } catch {
    return null;
  }
}
