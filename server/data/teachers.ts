import { and, desc, eq, isNull, or } from "drizzle-orm";
import {
  circles,
  dailyRecords,
  teachers,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== TEACHERS =====================
export async function getTeachers(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(teachers.deletedAt)];
  if (centerId) conditions.push(eq(teachers.centerId, centerId));
  return db.select().from(teachers).where(and(...conditions)).orderBy(desc(teachers.createdAt));
}

export async function getTeacherById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teachers).where(and(eq(teachers.id, id), isNull(teachers.deletedAt))).limit(1);
  return result[0];
}

export async function getTeacherByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teachers).where(and(eq(teachers.userId, userId), isNull(teachers.deletedAt))).limit(1);
  return result[0];
}

export async function getCircleIdsForTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: circles.id }).from(circles).where(and(isNull(circles.deletedAt), or(eq(circles.teacherId, teacherId), eq(circles.assistantTeacherId, teacherId))));
  return rows.map((row) => row.id);
}

export async function createTeacher(data: typeof teachers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(teachers).values(data);
}

export async function updateTeacher(id: number, data: Partial<typeof teachers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teachers).set({ ...data, updatedAt: new Date() }).where(eq(teachers.id, id));
}

export async function transferTeacherToCircle(teacherId: number, circleId: number, role: "teacher" | "assistant_teacher") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(circles).where(and(eq(circles.id, circleId), isNull(circles.deletedAt))).limit(1);
    if (!target) throw new Error("الحَلَقة المستهدفة غير متاحة");
    const occupied = role === "teacher" ? target.teacherId : target.assistantTeacherId;
    if (occupied && occupied !== teacherId) throw new Error("المقعد المحدد في الحَلَقة مرتبط بمعلم آخر");

    if (role === "teacher") {
      await tx.update(circles).set({ teacherId: null }).where(eq(circles.teacherId, teacherId));
      await tx.update(circles).set({ teacherId }).where(eq(circles.id, circleId));
    } else {
      await tx.update(circles).set({ assistantTeacherId: null }).where(eq(circles.assistantTeacherId, teacherId));
      await tx.update(circles).set({ assistantTeacherId: teacherId }).where(eq(circles.id, circleId));
    }
  });
}

export async function getTeacherLastActivity(teacherId: number) {
  const db = await getDb();
  if (!db) return null;
  // آخر نشاط: آخر تعديل على السجل اليومي في حلقة يعلّم فيها.
  const result = await db.select({ at: dailyRecords.updatedAt }).from(dailyRecords).innerJoin(circles, eq(dailyRecords.circleId, circles.id)).where(and(or(eq(circles.teacherId, teacherId), eq(circles.assistantTeacherId, teacherId)), isNull(circles.deletedAt))).orderBy(desc(dailyRecords.updatedAt)).limit(1);
  return result[0]?.at ?? null;
}

export async function softDeleteTeacher(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teachers).set({ deletedAt: new Date(), isActive: false }).where(eq(teachers.id, id));
}
