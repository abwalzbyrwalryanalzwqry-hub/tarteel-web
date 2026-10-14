import { and, desc, eq, isNull } from "drizzle-orm";
import {
  circles,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== CIRCLES =====================
export async function getCircles(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(circles.deletedAt)];
  if (centerId) conditions.push(eq(circles.centerId, centerId));
  return db.select().from(circles).where(and(...conditions)).orderBy(desc(circles.createdAt));
}

export async function getCircleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(circles).where(and(eq(circles.id, id), isNull(circles.deletedAt))).limit(1);
  return result[0];
}

export async function createCircle(data: typeof circles.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(circles).values(data);
}

export async function updateCircle(id: number, data: Partial<typeof circles.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circles).set({ ...data, updatedAt: new Date() }).where(eq(circles.id, id));
}

export async function softDeleteCircle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circles).set({ deletedAt: new Date(), isActive: false }).where(eq(circles.id, id));
}
