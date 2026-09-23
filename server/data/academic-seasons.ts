import { and, desc, eq, isNull } from "drizzle-orm";
import {
  academicSeasons,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== ACADEMIC SEASONS =====================
export async function getAcademicSeasons(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(academicSeasons.deletedAt)];
  if (centerId) conditions.push(eq(academicSeasons.centerId, centerId));
  return db.select().from(academicSeasons).where(and(...conditions)).orderBy(desc(academicSeasons.createdAt));
}

export async function getAcademicSeasonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(academicSeasons).where(and(eq(academicSeasons.id, id), isNull(academicSeasons.deletedAt))).limit(1);
  return result[0];
}

export async function createAcademicSeason(data: typeof academicSeasons.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(academicSeasons).values(data);
}

export async function updateAcademicSeason(id: number, data: Partial<typeof academicSeasons.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(academicSeasons).set({ ...data, updatedAt: new Date() }).where(eq(academicSeasons.id, id));
}

export async function softDeleteAcademicSeason(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(academicSeasons).set({ deletedAt: new Date(), isActive: false }).where(eq(academicSeasons.id, id));
}
