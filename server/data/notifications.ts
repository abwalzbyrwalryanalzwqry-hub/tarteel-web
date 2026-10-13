import { and, desc, eq, sql } from "drizzle-orm";
import {
  notifications,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== NOTIFICATIONS =====================
export async function getNotificationsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadNotificationsCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notifications).values(data);
}

/** يعلّم إشعاراً واحداً مقروءاً إن كان لهذا المستخدم؛ يعيد false إن لم يوجد له إشعار بهذا المعرّف. */
export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const owned = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, userId))).limit(1);
  if (!owned.length) return false;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return true;
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}
