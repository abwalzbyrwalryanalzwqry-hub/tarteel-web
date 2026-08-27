export const QURAN_READER_PROGRESS_KEY = "tarteel-quran-reader-last-page";

export interface QuranReadingProgress {
  page: number;
  updatedAt: number;
}

export function parseQuranReadingProgress(raw: string | null): QuranReadingProgress | null {
  if (!raw) return null;
  const legacyPage = Number(raw);
  if (Number.isInteger(legacyPage) && legacyPage >= 1 && legacyPage <= 604) return { page: legacyPage, updatedAt: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<QuranReadingProgress>;
    if (!Number.isInteger(parsed.page) || parsed.page! < 1 || parsed.page! > 604 || !Number.isFinite(parsed.updatedAt)) return null;
    return { page: parsed.page!, updatedAt: parsed.updatedAt! };
  } catch {
    return null;
  }
}
