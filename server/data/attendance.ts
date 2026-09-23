import { and, eq, inArray } from "drizzle-orm";
import {
  attendance,
} from "../../drizzle/schema";
import { getUnrecordedStudentIds } from "../../shared/attendance";
import { getDb } from "./connection";

// ===================== ATTENDANCE =====================
export async function getAttendanceBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return keepLatestAttendanceRows(await db.select().from(attendance).where(eq(attendance.sessionId, sessionId)));
}

/** يبقي آخر حالة حضور فقط لكل طالب وفترة عند قراءة سجلات تاريخية متكررة. */
export function keepLatestAttendanceRows<T extends { id: number; sessionId: number; studentId: number; updatedAt: Date }>(rows: T[]) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.sessionId}:${row.studentId}`;
    const current = latest.get(key);
    if (!current || row.updatedAt.getTime() > current.updatedAt.getTime() || (row.updatedAt.getTime() === current.updatedAt.getTime() && row.id > current.id)) latest.set(key, row);
  }
  return Array.from(latest.values());
}

export async function upsertAttendance(data: typeof attendance.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(attendance).values(data).onDuplicateKeyUpdate({
    set: { status: data.status, notes: data.notes, updatedAt: new Date() },
  });
}

/** يسجل الحضور للطلاب غير المسجلين فقط؛ ولا يبدل غياباً أو استئذاناً سجله المعلم يدوياً. */
export async function markUnrecordedAttendancePresent(sessionId: number, studentIds: readonly number[], recordedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const uniqueStudentIds = Array.from(new Set(studentIds.filter((studentId) => Number.isInteger(studentId) && studentId > 0)));
  if (!uniqueStudentIds.length) return { createdCount: 0, preservedCount: 0 };
  return db.transaction(async (tx) => {
    const existing = await tx.select({ studentId: attendance.studentId }).from(attendance)
      .where(and(eq(attendance.sessionId, sessionId), inArray(attendance.studentId, uniqueStudentIds)));
    const unrecordedIds = getUnrecordedStudentIds(uniqueStudentIds, existing.map((row) => row.studentId));
    if (unrecordedIds.length) {
      await tx.insert(attendance).values(unrecordedIds.map((studentId) => ({ sessionId, studentId, status: "present" as const, recordedBy })));
    }
    return { createdCount: unrecordedIds.length, preservedCount: existing.length };
  });
}
