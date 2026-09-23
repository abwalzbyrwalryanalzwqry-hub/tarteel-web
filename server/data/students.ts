import { and, eq, isNull, like } from "drizzle-orm";
import {
  students,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== STUDENTS =====================
export async function getStudents(centerId?: number, circleId?: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(students.deletedAt)];
  if (centerId) conditions.push(eq(students.centerId, centerId));
  if (circleId) conditions.push(eq(students.circleId, circleId));
  if (search) conditions.push(like(students.name, `%${search}%`));
  return db.select().from(students).where(and(...conditions)).orderBy(students.name);
}

export async function getStudentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(students).where(and(eq(students.id, id), isNull(students.deletedAt))).limit(1);
  return result[0];
}

export async function getStudentByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(students).where(and(eq(students.userId, userId), isNull(students.deletedAt))).limit(1);
  return result[0];
}

export async function getStudentsByGuardianUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(students).where(and(eq(students.guardianUserId, userId), isNull(students.deletedAt))).orderBy(students.name);
}

export async function createStudent(data: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(students).values(data);
}

export async function updateStudent(id: number, data: Partial<typeof students.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ ...data, updatedAt: new Date() }).where(eq(students.id, id));
}

export async function softDeleteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ deletedAt: new Date(), isActive: false }).where(eq(students.id, id));
}
