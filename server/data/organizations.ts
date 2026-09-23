import { and, desc, eq, isNull } from "drizzle-orm";
import {
  organizations,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== ORGANIZATIONS =====================
export async function getOrganizations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizations).where(isNull(organizations.deletedAt)).orderBy(desc(organizations.createdAt));
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(and(eq(organizations.id, id), isNull(organizations.deletedAt))).limit(1);
  return result[0];
}

export async function createOrganization(data: typeof organizations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(organizations).values(data);
  return result[0];
}

export async function updateOrganization(id: number, data: Partial<typeof organizations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id));
}

export async function softDeleteOrganization(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(organizations).set({ deletedAt: new Date(), isActive: false }).where(eq(organizations.id, id));
}
