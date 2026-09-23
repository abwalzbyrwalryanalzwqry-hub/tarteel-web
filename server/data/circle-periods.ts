import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  attendance,
  circlePeriods,
  memorization,
  revision,
  sessions,
} from "../../drizzle/schema";
import { keepLatestAttendanceRows } from "./attendance";
import { getDb } from "./connection";
import { getStudents } from "./students";

// ===================== CIRCLE PERIODS =====================
export async function getCirclePeriods(circleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(circlePeriods).where(and(eq(circlePeriods.circleId, circleId), isNull(circlePeriods.deletedAt))).orderBy(circlePeriods.startTime);
}

export async function getCirclePeriodById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(circlePeriods).where(and(eq(circlePeriods.id, id), isNull(circlePeriods.deletedAt))).limit(1);
  return result[0];
}

export async function createCirclePeriod(data: typeof circlePeriods.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(circlePeriods).values(data);
}

export async function updateCirclePeriod(id: number, data: Partial<typeof circlePeriods.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circlePeriods).set({ ...data, updatedAt: new Date() }).where(eq(circlePeriods.id, id));
}

export async function softDeleteCirclePeriod(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circlePeriods).set({ deletedAt: new Date(), isActive: false }).where(eq(circlePeriods.id, id));
}

export async function getCircleMonthlyRecord(circleId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const studentRows = await getStudents(undefined, circleId);
  const sessionConditions = [eq(sessions.circleId, circleId), isNull(sessions.deletedAt)];
  if (startDate) sessionConditions.push(gte(sessions.scheduledAt, startDate));
  if (endDate) sessionConditions.push(lte(sessions.scheduledAt, endDate));
  const sessionRows = await db.select({ id: sessions.id }).from(sessions).where(and(...sessionConditions));
  const sessionIds = sessionRows.map((row) => row.id);
  if (!sessionIds.length) return studentRows.map((student) => ({ student, present: 0, absent: 0, excused: 0, late: 0, memorizedPages: 0, reviewedPages: 0, lastMemorization: null, lastRevision: null }));

  const [attendanceRows, memorizationRows, revisionRows] = await Promise.all([
    db.select().from(attendance).where(inArray(attendance.sessionId, sessionIds)),
    db.select().from(memorization).where(inArray(memorization.sessionId, sessionIds)).orderBy(desc(memorization.createdAt)),
    db.select().from(revision).where(inArray(revision.sessionId, sessionIds)).orderBy(desc(revision.createdAt)),
  ]);
  const currentAttendanceRows = keepLatestAttendanceRows(attendanceRows);

  return studentRows.map((student) => {
    const studentAttendance = currentAttendanceRows.filter((row) => row.studentId === student.id);
    const studentMemorization = memorizationRows.filter((row) => row.studentId === student.id);
    const studentRevision = revisionRows.filter((row) => row.studentId === student.id);
    return {
      student,
      present: studentAttendance.filter((row) => row.status === "present").length,
      absent: studentAttendance.filter((row) => row.status === "absent").length,
      excused: studentAttendance.filter((row) => row.status === "excused").length,
      late: studentAttendance.filter((row) => row.status === "late").length,
      memorizedPages: studentMemorization.reduce((sum, row) => sum + Number(row.pages ?? 0), 0),
      reviewedPages: studentRevision.reduce((sum, row) => sum + Number(row.pages ?? 0), 0),
      lastMemorization: studentMemorization[0] ?? null,
      lastRevision: studentRevision[0] ?? null,
    };
  });
}
