import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import {
  centerMemberships,
  centers,
  organizations,
  reportingGoals,
  reportingPreferences,
  userScopes,
  users,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== CENTERS =====================
export async function getCenters(orgId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(centers.deletedAt)];
  if (orgId) conditions.push(eq(centers.organizationId, orgId));
  return db.select().from(centers).where(and(...conditions)).orderBy(desc(centers.createdAt));
}

export async function getCenterById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(centers).where(and(eq(centers.id, id), isNull(centers.deletedAt))).limit(1);
  return result[0];
}

export async function createCenter(data: typeof centers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(centers).values(data);
}

export async function provisionIndependentCenter(input: { userId: number; centerName: string; organizationName?: string; phone?: string; email?: string; address?: string; city?: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx) => {
    const now = new Date();
    const existingMembership = await tx.select({ id: centerMemberships.id }).from(centerMemberships).where(and(eq(centerMemberships.userId, input.userId), eq(centerMemberships.status, "active"), isNull(centerMemberships.revokedAt), or(isNull(centerMemberships.expiresAt), gt(centerMemberships.expiresAt, now)))).limit(1);
    if (existingMembership[0]) throw new Error("الحساب مفعّل بالفعل في مركز قائم");
    const organizationResult = await tx.insert(organizations).values({ name: input.organizationName?.trim() || input.centerName, description: input.description, phone: input.phone, email: input.email || null, address: input.address, city: input.city, adminId: input.userId, isActive: true });
    const organizationId = Number(organizationResult[0]?.insertId);
    if (!Number.isInteger(organizationId) || organizationId < 1) throw new Error("تعذر إنشاء الجهة التابعة للمركز");
    const centerResult = await tx.insert(centers).values({ organizationId, name: input.centerName, description: input.description, phone: input.phone, email: input.email || null, address: input.address, city: input.city, managerId: input.userId, isActive: true });
    const centerId = Number(centerResult[0]?.insertId);
    if (!Number.isInteger(centerId) || centerId < 1) throw new Error("تعذر إنشاء المركز");
    await tx.insert(centerMemberships).values({ userId: input.userId, centerId, role: "center_manager", status: "active", isOwner: true, grantedBy: input.userId, grantedAt: now });
    await tx.insert(userScopes).values({ userId: input.userId, centerId, scopeType: "center", grantedBy: input.userId });
    await tx.update(users).set({ role: "center_manager", isActive: true, accountStatus: "active", accessRevokedAt: null, lastActiveAt: now, updatedAt: now }).where(eq(users.id, input.userId));
    return { organizationId, centerId };
  });
}

export async function updateCenter(id: number, data: Partial<typeof centers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(centers).set({ ...data, updatedAt: new Date() }).where(eq(centers.id, id));
}

export async function softDeleteCenter(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(centers).set({ deletedAt: new Date(), isActive: false }).where(eq(centers.id, id));
}

export async function getReportingGoals(centerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reportingGoals).where(eq(reportingGoals.centerId, centerId)).limit(1);
  return result[0];
}

export async function saveReportingGoals(input: { centerId: number; attendanceTarget?: number | null; memorizedPagesTarget?: number | null; reviewedPagesTarget?: number | null; updatedBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  await db.insert(reportingGoals).values(input).onDuplicateKeyUpdate({ set: { attendanceTarget: input.attendanceTarget ?? null, memorizedPagesTarget: input.memorizedPagesTarget ?? null, reviewedPagesTarget: input.reviewedPagesTarget ?? null, updatedBy: input.updatedBy, updatedAt: now } });
  return getReportingGoals(input.centerId);
}

export async function getReportingPreferences(centerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reportingPreferences).where(eq(reportingPreferences.centerId, centerId)).limit(1);
  return result[0];
}

export async function saveReportingPreferences(input: { centerId: number; headerTitle?: string | null; footerText?: string | null; logoUrl?: string | null; logoKey?: string | null; teacherMessageTemplate?: string | null; updatedBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  await db.insert(reportingPreferences).values(input).onDuplicateKeyUpdate({ set: { headerTitle: input.headerTitle ?? null, footerText: input.footerText ?? null, logoUrl: input.logoUrl ?? null, logoKey: input.logoKey ?? null, teacherMessageTemplate: input.teacherMessageTemplate ?? null, updatedBy: input.updatedBy, updatedAt: now } });
  return getReportingPreferences(input.centerId);
}
