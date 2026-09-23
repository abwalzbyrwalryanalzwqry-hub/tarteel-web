import { and, desc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import {
  attendance,
  evaluation,
  memorization,
  revision,
  sessions,
  students,
} from "../../drizzle/schema";
import { keepLatestAttendanceRows } from "./attendance";
import { getDb } from "./connection";
import { getStudentById } from "./students";

// ===================== MEMORIZATION =====================
export async function getMemorizationBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memorization).where(eq(memorization.sessionId, sessionId));
}

export async function getMemorizationByStudent(studentId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memorization).where(eq(memorization.studentId, studentId)).orderBy(desc(memorization.createdAt)).limit(limit);
}

export async function getRevisionByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(revision).where(eq(revision.studentId, studentId)).orderBy(desc(revision.createdAt));
}

export async function getStudentMizanProfile(studentId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return undefined;
  const student = await getStudentById(studentId);
  if (!student) return undefined;
  const sessionConditions = [eq(sessions.circleId, student.circleId ?? -1), isNull(sessions.deletedAt), ne(sessions.status, "draft")];
  if (startDate) sessionConditions.push(gte(sessions.scheduledAt, startDate));
  if (endDate) sessionConditions.push(lte(sessions.scheduledAt, endDate));
  const sessionRows = await db.select({ id: sessions.id }).from(sessions).where(and(...sessionConditions));
  const sessionIds = sessionRows.map((row) => row.id);
  const [memorizationRows, revisionRows, attendanceRows, evaluationRows] = await Promise.all([
    db.select().from(memorization).where(eq(memorization.studentId, studentId)).orderBy(desc(memorization.createdAt)),
    getRevisionByStudent(studentId),
    sessionIds.length ? db.select().from(attendance).where(and(eq(attendance.studentId, studentId), inArray(attendance.sessionId, sessionIds))) : Promise.resolve([]),
    sessionIds.length ? db.select().from(evaluation).where(and(eq(evaluation.studentId, studentId), inArray(evaluation.sessionId, sessionIds))).orderBy(desc(evaluation.createdAt)) : Promise.resolve([]),
  ]);
  const withinRange = <T extends { createdAt: Date }>(rows: T[]) => rows.filter((row) => (!startDate || row.createdAt >= startDate) && (!endDate || row.createdAt <= endDate));
  return { student, memorization: withinRange(memorizationRows), revision: withinRange(revisionRows), attendance: keepLatestAttendanceRows(attendanceRows), evaluations: evaluationRows };
}

export async function createMemorization(data: typeof memorization.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(memorization).values(data).onDuplicateKeyUpdate({
    set: { surahNumber: data.surahNumber, toSurahNumber: data.toSurahNumber, fromAyah: data.fromAyah, toAyah: data.toAyah, pages: data.pages, grade: data.grade, notes: data.notes, recordedBy: data.recordedBy, updatedAt: new Date() },
  });
  await db.update(students).set({ lastMemorizedSurah: data.toSurahNumber ?? data.surahNumber, lastMemorizedAyah: data.toAyah, updatedAt: new Date() }).where(eq(students.id, data.studentId));
}

export async function updateMemorization(id: number, data: Partial<typeof memorization.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(memorization).set({ ...data, updatedAt: new Date() }).where(eq(memorization.id, id));
}
