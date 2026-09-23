import { and, desc, eq } from "drizzle-orm";
import {
  quranVersePreferences,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== QURAN VERSE PREFERENCES =====================
export async function getQuranVersePreferencesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quranVersePreferences).where(eq(quranVersePreferences.userId, userId)).orderBy(desc(quranVersePreferences.updatedAt));
}

export async function saveQuranVersePreference(input: typeof quranVersePreferences.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  await db.insert(quranVersePreferences).values(input).onDuplicateKeyUpdate({ set: { pageNumber: input.pageNumber, surahNumber: input.surahNumber, ayahNumber: input.ayahNumber, isFavorite: input.isFavorite, note: input.note ?? null, updatedAt: now } });
  const result = await db.select().from(quranVersePreferences).where(and(eq(quranVersePreferences.userId, input.userId), eq(quranVersePreferences.verseKey, input.verseKey))).limit(1);
  return result[0];
}

export async function deleteQuranVersePreferenceForUser(userId: number, verseKey: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(quranVersePreferences).where(and(eq(quranVersePreferences.userId, userId), eq(quranVersePreferences.verseKey, verseKey)));
}
