import { and, eq, inArray, sql } from "drizzle-orm";
import {
  attendance,
  centers,
  circles,
  evaluation,
  memorization,
  revision,
  sessions,
  students,
  teachers,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== TRASH =====================
export async function getTrashedItems() {
  const db = await getDb();
  if (!db) return { centers: [], teachers: [], students: [], circles: [], sessions: [] };

  const [trashedCenters, trashedTeachers, trashedStudents, trashedCircles, trashedSessions] = await Promise.all([
    db.select().from(centers).where(sql`${centers.deletedAt} IS NOT NULL`),
    db.select().from(teachers).where(sql`${teachers.deletedAt} IS NOT NULL`),
    db.select().from(students).where(sql`${students.deletedAt} IS NOT NULL`),
    db.select().from(circles).where(sql`${circles.deletedAt} IS NOT NULL`),
    db.select().from(sessions).where(sql`${sessions.deletedAt} IS NOT NULL`),
  ]);

  return {
    centers: trashedCenters,
    teachers: trashedTeachers,
    students: trashedStudents,
    circles: trashedCircles,
    sessions: trashedSessions,
  };
}

export async function getTrashedItemsForCenters(centerIds: number[]) {
  if (!centerIds.length) return { centers: [], teachers: [], students: [], circles: [], sessions: [] };
  const db = await getDb();
  if (!db) return { centers: [], teachers: [], students: [], circles: [], sessions: [] };
  const [trashedCenters, trashedTeachers, trashedStudents, trashedCircles, trashedSessions] = await Promise.all([
    db.select().from(centers).where(and(inArray(centers.id, centerIds), sql`${centers.deletedAt} IS NOT NULL`)),
    db.select().from(teachers).where(and(inArray(teachers.centerId, centerIds), sql`${teachers.deletedAt} IS NOT NULL`)),
    db.select().from(students).where(and(inArray(students.centerId, centerIds), sql`${students.deletedAt} IS NOT NULL`)),
    db.select().from(circles).where(and(inArray(circles.centerId, centerIds), sql`${circles.deletedAt} IS NOT NULL`)),
    db.select().from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).where(and(inArray(circles.centerId, centerIds), sql`${sessions.deletedAt} IS NOT NULL`)),
  ]);
  return { centers: trashedCenters, teachers: trashedTeachers, students: trashedStudents, circles: trashedCircles, sessions: trashedSessions.map((row) => row.sessions) };
}

export async function getTrashedItemsForCircles(circleIds: number[]) {
  if (!circleIds.length) return { centers: [], teachers: [], students: [], circles: [], sessions: [] };
  const db = await getDb();
  if (!db) return { centers: [], teachers: [], students: [], circles: [], sessions: [] };
  const trashedSessions = await db.select().from(sessions).where(and(inArray(sessions.circleId, circleIds), sql`${sessions.deletedAt} IS NOT NULL`));
  return { centers: [], teachers: [], students: [], circles: [], sessions: trashedSessions };
}

export async function getTrashedItemCenterId(table: "centers" | "teachers" | "students" | "circles" | "sessions", id: number) {
  const db = await getDb();
  if (!db) return undefined;
  if (table === "centers") return id;
  if (table === "teachers") return (await db.select({ centerId: teachers.centerId }).from(teachers).where(and(eq(teachers.id, id), sql`${teachers.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  if (table === "students") return (await db.select({ centerId: students.centerId }).from(students).where(and(eq(students.id, id), sql`${students.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  if (table === "circles") return (await db.select({ centerId: circles.centerId }).from(circles).where(and(eq(circles.id, id), sql`${circles.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  return (await db.select({ centerId: circles.centerId }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).where(and(eq(sessions.id, id), sql`${sessions.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
}

export async function getTrashedSessionCircleId(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select({ circleId: sessions.circleId }).from(sessions).where(and(eq(sessions.id, id), sql`${sessions.deletedAt} IS NOT NULL`)).limit(1))[0]?.circleId;
}

export async function restoreItem(table: string, id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const tableMap: Record<string, typeof centers | typeof teachers | typeof students | typeof circles | typeof sessions> = {
    centers,
    teachers,
    students,
    circles,
    sessions,
  };

  const t = tableMap[table];
  if (!t) throw new Error("Invalid table");

  if (table === "sessions") {
    await db.update(sessions).set({ deletedAt: null }).where(eq(sessions.id, id));
    return;
  }
  await db.update(t as typeof centers).set({ deletedAt: null, isActive: true } as any).where(eq((t as typeof centers).id, id));
}

export async function permanentlyDeleteTrashedSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx) => {
    const trashed = await tx.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, id), sql`${sessions.deletedAt} IS NOT NULL`)).limit(1);
    if (!trashed[0]) return false;
    await tx.delete(attendance).where(eq(attendance.sessionId, id));
    await tx.delete(memorization).where(eq(memorization.sessionId, id));
    await tx.delete(revision).where(eq(revision.sessionId, id));
    await tx.delete(evaluation).where(eq(evaluation.sessionId, id));
    await tx.delete(sessions).where(eq(sessions.id, id));
    return true;
  });
}
