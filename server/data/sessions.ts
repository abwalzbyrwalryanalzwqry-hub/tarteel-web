import { and, desc, eq, isNull, ne } from "drizzle-orm";
import {
  sessions,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== SESSIONS =====================
export async function getSessions(circleId?: number, seasonId?: number, includeDrafts = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(sessions.deletedAt)];
  if (!includeDrafts) conditions.push(ne(sessions.status, "draft"));
  if (circleId) conditions.push(eq(sessions.circleId, circleId));
  if (seasonId) conditions.push(eq(sessions.seasonId, seasonId));
  return db.select().from(sessions).where(and(...conditions)).orderBy(desc(sessions.scheduledAt));
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions).where(and(eq(sessions.id, id), isNull(sessions.deletedAt))).limit(1);
  return result[0];
}

/** تعيد الفترة الوحيدة للحلقة في اليوم التشغيلي المحدد، إن وُجدت. */
export async function getSessionByCircleDay(circleId: number, dayKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions).where(and(eq(sessions.circleId, circleId), eq(sessions.dayKey, dayKey), isNull(sessions.deletedAt))).limit(1);
  return result[0];
}

export async function createSession(data: typeof sessions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(sessions).values(data);
  return result;
}

export async function updateSession(id: number, data: Partial<typeof sessions.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sessions).set({ ...data, updatedAt: new Date() }).where(eq(sessions.id, id));
}

export async function softDeleteSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sessions).set({ deletedAt: new Date() }).where(eq(sessions.id, id));
}
