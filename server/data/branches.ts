import { and, desc, eq, isNull } from "drizzle-orm";
import {
  branches,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== BRANCHES =====================
export async function getBranches(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(branches.deletedAt)];
  if (centerId) conditions.push(eq(branches.centerId, centerId));
  return db.select().from(branches).where(and(...conditions)).orderBy(desc(branches.createdAt));
}

export async function getBranchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(branches).where(and(eq(branches.id, id), isNull(branches.deletedAt))).limit(1);
  return result[0];
}

export async function createBranch(data: typeof branches.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(branches).values(data);
}

export async function updateBranch(id: number, data: Partial<typeof branches.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(branches).set({ ...data, updatedAt: new Date() }).where(eq(branches.id, id));
}

export async function softDeleteBranch(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(branches).set({ deletedAt: new Date(), isActive: false }).where(eq(branches.id, id));
}
