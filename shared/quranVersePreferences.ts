import { getQuranBookmarkReferenceKey } from "./quranBookmarks";

export type QuranVersePreferenceInput = {
  pageNumber: number;
  surahNumber: number;
  ayahNumber: number;
  isFavorite: boolean;
  note: string | null;
};

export function normalizeQuranVersePreference(input: QuranVersePreferenceInput) {
  const verseKey = getQuranBookmarkReferenceKey({ referenceType: "ayah", pageNumber: input.pageNumber, surahNumber: input.surahNumber, ayahNumber: input.ayahNumber });
  const note = input.note?.trim() || null;
  return { ...input, verseKey, note, shouldPersist: input.isFavorite || Boolean(note) };
}
