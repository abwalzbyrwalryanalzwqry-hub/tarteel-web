import { and, desc, eq } from "drizzle-orm";
import {
  quranBookmarks,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== QURAN BOOKMARKS =====================
export async function getQuranBookmarksForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quranBookmarks).where(eq(quranBookmarks.userId, userId)).orderBy(desc(quranBookmarks.updatedAt));
}

export async function getQuranBookmarkForUser(userId: number, referenceKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quranBookmarks).where(and(eq(quranBookmarks.userId, userId), eq(quranBookmarks.referenceKey, referenceKey))).limit(1);
  return result[0];
}

export async function saveQuranBookmark(input: typeof quranBookmarks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  await db.insert(quranBookmarks).values(input).onDuplicateKeyUpdate({ set: { pageNumber: input.pageNumber, surahNumber: input.surahNumber ?? null, ayahNumber: input.ayahNumber ?? null, label: input.label ?? null, updatedAt: now } });
  return getQuranBookmarkForUser(input.userId, input.referenceKey);
}

export async function deleteQuranBookmarkForUser(userId: number, referenceKey: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(quranBookmarks).where(and(eq(quranBookmarks.userId, userId), eq(quranBookmarks.referenceKey, referenceKey)));
}
