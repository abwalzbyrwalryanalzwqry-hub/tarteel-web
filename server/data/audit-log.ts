import { desc, eq } from "drizzle-orm";
import {
  auditLog,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== AUDIT LOG =====================
export async function createAuditLog(data: typeof auditLog.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLog).values(data);
}

export async function getAuditLog(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

export async function getAuditLogForCenter(centerId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog).where(eq(auditLog.centerId, centerId)).orderBy(desc(auditLog.createdAt)).limit(limit);
}
