import { desc, eq, isNull, sql } from "drizzle-orm";
import {
  InsertUser,
  users,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== USERS =====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(isNull(users.deletedAt)).limit(limit).offset(offset).orderBy(desc(users.createdAt));
}

/** يبطل كل الجلسات الحالية للمستخدم ويعيد رقم الإصدار الجديد. */
export async function bumpSessionVersion(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
  const row = (await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1))[0];
  return row?.sessionVersion ?? 0;
}

/** تحديث آخر نشاط دون الكتابة في قاعدة البيانات مع كل طلب. */
export const LAST_SIGNED_IN_THROTTLE_MS = 15 * 60 * 1000;
export async function touchLastSignedIn(user: { id: number; lastSignedIn: Date | null }, now = new Date()): Promise<boolean> {
  if (user.lastSignedIn && now.getTime() - new Date(user.lastSignedIn).getTime() < LAST_SIGNED_IN_THROTTLE_MS) return false;
  const db = await getDb();
  if (!db) return false;
  await db.update(users).set({ lastSignedIn: now }).where(eq(users.id, user.id));
  return true;
}
