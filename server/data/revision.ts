import { and, desc, eq, isNull, ne } from "drizzle-orm";
import {
  memorization,
  revision,
  sessions,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== REVISION =====================
export async function getRevisionBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(revision).where(eq(revision.sessionId, sessionId));
}

export async function createRevision(data: typeof revision.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(revision).values(data).onDuplicateKeyUpdate({
    set: { surahNumber: data.surahNumber, toSurahNumber: data.toSurahNumber, fromAyah: data.fromAyah, toAyah: data.toAyah, pages: data.pages, grade: data.grade, notes: data.notes, recordedBy: data.recordedBy, updatedAt: new Date() },
  });
}

/** آخر موضع حفظ ومراجعة لكل طالب في الحلقة، لبدء الفترة التالية من حيث انتهى. */
export async function getLatestStudentPeriodProgress(circleId: number) {
  const db = await getDb();
  if (!db) return {} as Record<number, { memorization: typeof memorization.$inferSelect | null; revision: typeof revision.$inferSelect | null }>;
  const [memorizationRows, revisionRows] = await Promise.all([
    db.select({ record: memorization }).from(memorization).innerJoin(sessions, eq(memorization.sessionId, sessions.id)).where(and(eq(sessions.circleId, circleId), isNull(sessions.deletedAt), ne(sessions.status, "draft"))).orderBy(desc(sessions.scheduledAt), desc(memorization.updatedAt)),
    db.select({ record: revision }).from(revision).innerJoin(sessions, eq(revision.sessionId, sessions.id)).where(and(eq(sessions.circleId, circleId), isNull(sessions.deletedAt), ne(sessions.status, "draft"))).orderBy(desc(sessions.scheduledAt), desc(revision.updatedAt)),
  ]);
  const progress: Record<number, { memorization: typeof memorization.$inferSelect | null; revision: typeof revision.$inferSelect | null }> = {};
  for (const row of memorizationRows) if (!progress[row.record.studentId]?.memorization) progress[row.record.studentId] = { memorization: row.record, revision: progress[row.record.studentId]?.revision ?? null };
  for (const row of revisionRows) if (!progress[row.record.studentId]?.revision) progress[row.record.studentId] = { memorization: progress[row.record.studentId]?.memorization ?? null, revision: row.record };
  return progress;
}
