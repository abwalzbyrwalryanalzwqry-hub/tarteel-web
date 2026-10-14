import { and, eq, inArray, sql } from "drizzle-orm";
import {
  centers,
  circles,
  students,
  teachers,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== TRASH =====================
export async function getTrashedItems() {
  const db = await getDb();
  if (!db) return { centers: [], teachers: [], students: [], circles: [] };

  const [trashedCenters, trashedTeachers, trashedStudents, trashedCircles] = await Promise.all([
    db.select().from(centers).where(sql`${centers.deletedAt} IS NOT NULL`),
    db.select().from(teachers).where(sql`${teachers.deletedAt} IS NOT NULL`),
    db.select().from(students).where(sql`${students.deletedAt} IS NOT NULL`),
    db.select().from(circles).where(sql`${circles.deletedAt} IS NOT NULL`),
  ]);

  return {
    centers: trashedCenters,
    teachers: trashedTeachers,
    students: trashedStudents,
    circles: trashedCircles,
  };
}

export async function getTrashedItemsForCenters(centerIds: number[]) {
  if (!centerIds.length) return { centers: [], teachers: [], students: [], circles: [] };
  const db = await getDb();
  if (!db) return { centers: [], teachers: [], students: [], circles: [] };
  const [trashedCenters, trashedTeachers, trashedStudents, trashedCircles] = await Promise.all([
    db.select().from(centers).where(and(inArray(centers.id, centerIds), sql`${centers.deletedAt} IS NOT NULL`)),
    db.select().from(teachers).where(and(inArray(teachers.centerId, centerIds), sql`${teachers.deletedAt} IS NOT NULL`)),
    db.select().from(students).where(and(inArray(students.centerId, centerIds), sql`${students.deletedAt} IS NOT NULL`)),
    db.select().from(circles).where(and(inArray(circles.centerId, centerIds), sql`${circles.deletedAt} IS NOT NULL`)),
  ]);
  return { centers: trashedCenters, teachers: trashedTeachers, students: trashedStudents, circles: trashedCircles };
}

/** المعلم لا يملك عناصر في سلّة المنصة: أيام السجل المحذوفة في سلّة السجل اليومي نفسه. */
export async function getTrashedItemsForCircles(_circleIds: number[]) {
  return { centers: [], teachers: [], students: [], circles: [] };
}

export async function getTrashedItemCenterId(table: "centers" | "teachers" | "students" | "circles", id: number) {
  const db = await getDb();
  if (!db) return undefined;
  if (table === "centers") return id;
  if (table === "teachers") return (await db.select({ centerId: teachers.centerId }).from(teachers).where(and(eq(teachers.id, id), sql`${teachers.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  if (table === "students") return (await db.select({ centerId: students.centerId }).from(students).where(and(eq(students.id, id), sql`${students.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  if (table === "circles") return (await db.select({ centerId: circles.centerId }).from(circles).where(and(eq(circles.id, id), sql`${circles.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  return undefined;
}

export async function restoreItem(table: string, id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const tableMap: Record<string, typeof centers | typeof teachers | typeof students | typeof circles > = {
    centers,
    teachers,
    students,
    circles,
  };

  const t = tableMap[table];
  if (!t) throw new Error("Invalid table");

  await db.update(t as typeof centers).set({ deletedAt: null, isActive: true } as any).where(eq((t as typeof centers).id, id));
}

