import { and, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  accessCodeAttempts,
  accessCodes,
  branches,
  centerMemberships,
  centers,
  circles,
  notifications,
  parentStudentLinks,
  permissionGrants,
  students,
  teachers,
  userScopes,
  users,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== ACCESS CONTROL =====================
export async function getUserCenterMemberships(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(centerMemberships).where(eq(centerMemberships.userId, userId)).orderBy(desc(centerMemberships.createdAt));
}

export async function getActiveCenterMembership(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();
  const result = await db.select().from(centerMemberships).where(and(eq(centerMemberships.userId, userId), eq(centerMemberships.centerId, centerId), eq(centerMemberships.status, "active"), isNull(centerMemberships.revokedAt), or(isNull(centerMemberships.expiresAt), gt(centerMemberships.expiresAt, now)))).limit(1);
  return result[0];
}

export async function getActivePermissionGrants(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(permissionGrants).where(and(eq(permissionGrants.userId, userId), eq(permissionGrants.centerId, centerId), isNull(permissionGrants.revokedAt), or(isNull(permissionGrants.expiresAt), gt(permissionGrants.expiresAt, now))));
}

export async function getActiveUserScopes(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(userScopes).where(and(eq(userScopes.userId, userId), eq(userScopes.centerId, centerId), isNull(userScopes.revokedAt), or(isNull(userScopes.expiresAt), gt(userScopes.expiresAt, now))));
}

export async function getCenterIdForCircle(circleId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ centerId: branches.centerId }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(eq(circles.id, circleId), isNull(circles.deletedAt), isNull(branches.deletedAt))).limit(1);
  return result[0]?.centerId;
}

export async function getCenterIdForStudent(studentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ centerId: students.centerId }).from(students).where(and(eq(students.id, studentId), isNull(students.deletedAt))).limit(1);
  return result[0]?.centerId;
}

export async function getAccessCodesForCenter(centerId: number) {
  const db = await getDb();
  if (!db) return [];
  await db.update(accessCodes).set({ status: "expired", updatedAt: new Date() }).where(and(eq(accessCodes.centerId, centerId), eq(accessCodes.status, "active"), lte(accessCodes.expiresAt, new Date())));
  return db.select().from(accessCodes).where(eq(accessCodes.centerId, centerId)).orderBy(desc(accessCodes.createdAt));
}

export async function getAccessCodeByHash(codeHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accessCodes).where(eq(accessCodes.codeHash, codeHash)).limit(1);
  return result[0];
}

export async function createAccessCode(data: typeof accessCodes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(accessCodes).values(data);
  return Number(result[0].insertId);
}

export async function revokeAccessCode(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(accessCodes).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(eq(accessCodes.id, id));
}

export async function getAccessCodeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accessCodes).where(eq(accessCodes.id, id)).limit(1);
  return result[0];
}

export async function recordAccessCodeAttempt(data: typeof accessCodeAttempts.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(accessCodeAttempts).values(data);
}

export async function getParentStudentLinks(guardianUserId: number, centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(parentStudentLinks.guardianUserId, guardianUserId)];
  if (centerId) conditions.push(eq(parentStudentLinks.centerId, centerId));
  return db.select().from(parentStudentLinks).where(and(...conditions));
}

export async function getCenterMembers(centerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ membership: centerMemberships, user: users }).from(centerMemberships).innerJoin(users, eq(centerMemberships.userId, users.id)).where(eq(centerMemberships.centerId, centerId)).orderBy(desc(centerMemberships.createdAt));
}

export async function getCenterMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(centerMemberships).where(eq(centerMemberships.id, id)).limit(1);
  return result[0];
}

export async function createCenterMembership(data: typeof centerMemberships.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(centerMemberships).values(data);
  return Number(result[0].insertId);
}

export async function updateCenterMembership(id: number, data: Partial<typeof centerMemberships.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(centerMemberships).set({ ...data, updatedAt: new Date() }).where(eq(centerMemberships.id, id));
}

export async function revokeUserPermissionGrants(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(permissionGrants).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(permissionGrants.userId, userId), eq(permissionGrants.centerId, centerId), isNull(permissionGrants.revokedAt)));
}

export async function createPermissionGrants(data: (typeof permissionGrants.$inferInsert)[]) {
  if (!data.length) return;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(permissionGrants).values(data);
}

export async function revokeUserScopes(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(userScopes).set({ revokedAt: new Date() }).where(and(eq(userScopes.userId, userId), eq(userScopes.centerId, centerId), isNull(userScopes.revokedAt)));
}

export async function createUserScopes(data: (typeof userScopes.$inferInsert)[]) {
  if (!data.length) return;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(userScopes).values(data);
}

/**
 * رفض استرداد يجب تسجيله. يُرمى داخل المعاملة ويُسجَّل بعد التراجع عنها:
 * لو كُتب العدّاد داخل المعاملة نفسها لتراجع MySQL عنه مع الخطأ، فلا يُقفل الرمز أبداً.
 */
export class AccessCodeRejection extends Error {
  constructor(message: string, readonly record: { accessCodeId?: number; disable?: boolean }) {
    super(message);
    this.name = "AccessCodeRejection";
  }
}

export const ACCESS_CODE_LOCK_AFTER = 5;
export const ACCESS_CODE_DISABLE_AFTER = 10;

async function recordAccessCodeRejection(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  input: { codeHash: string; userId: number; ipAddress?: string; userAgent?: string },
  record: AccessCodeRejection["record"],
  now: Date,
) {
  await db.insert(accessCodeAttempts).values({ accessCodeId: record.accessCodeId ?? null, codeFingerprint: input.codeHash, attemptedByUserId: input.userId, wasSuccessful: false, ipAddress: input.ipAddress, userAgent: input.userAgent });
  if (!record.accessCodeId) return;
  // MySQL يطبق التعيينات بالترتيب، فالشرطان التاليان يقرآن failedAttempts بعد زيادتها (تحديث ذري بلا سباق).
  const lockUntil = new Date(now.getTime() + 15 * 60_000);
  await db.update(accessCodes).set({
    failedAttempts: sql`${accessCodes.failedAttempts} + 1`,
    lockedUntil: sql`IF(${accessCodes.failedAttempts} >= ${ACCESS_CODE_LOCK_AFTER}, ${lockUntil}, ${accessCodes.lockedUntil})`,
    status: record.disable ? "disabled" : sql`IF(${accessCodes.failedAttempts} >= ${ACCESS_CODE_DISABLE_AFTER}, 'disabled', ${accessCodes.status})`,
    updatedAt: now,
  }).where(eq(accessCodes.id, record.accessCodeId));
}

export async function redeemAccessCodeSecure(input: { codeHash: string; userId: number; ipAddress?: string; userAgent?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const now = new Date();
  try {
    return await redeemAccessCodeInTransaction(db, input, now);
  } catch (error) {
    if (error instanceof AccessCodeRejection) {
      await recordAccessCodeRejection(db, input, error.record, now).catch((recordError) => console.warn("[AccessCode] failed to record rejection", String(recordError)));
    }
    throw error;
  }
}

async function redeemAccessCodeInTransaction(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  input: { codeHash: string; userId: number; ipAddress?: string; userAgent?: string },
  now: Date,
) {
  return db.transaction(async (tx) => {
    const [accessCode] = await tx.select().from(accessCodes).where(eq(accessCodes.codeHash, input.codeHash)).limit(1);
    if (!accessCode) throw new AccessCodeRejection("رمز الدخول غير صحيح", {});
    const invalidate = (message: string, disable = false): never => {
      throw new AccessCodeRejection(message, { accessCodeId: accessCode.id, disable });
    };
    if (accessCode.status !== "active") invalidate("هذا الرمز غير متاح", true);
    if (accessCode.lockedUntil && accessCode.lockedUntil > now) invalidate("تم تعليق محاولات هذا الرمز مؤقتاً");
    if (accessCode.expiresAt && accessCode.expiresAt <= now) invalidate("انتهت صلاحية هذا الرمز", true);
    if (accessCode.usedCount >= accessCode.maxUses) invalidate("تم استخدام هذا الرمز بالكامل", true);
    const isTeacherAccessCode = accessCode.role === "teacher" || accessCode.role === "assistant_teacher";
    const isReaderAccessCode = accessCode.role === "student" || accessCode.role === "guardian";
    const isGuideAccessCode = accessCode.role === "guide";
    if (isTeacherAccessCode) {
      if (!accessCode.circleId || accessCode.maxUses !== 1) throw new Error("كود المعلم غير صالح؛ يلزم حلقة واحدة واستخدام واحد");
      let embeddedScopes: unknown[] = [];
      try { embeddedScopes = accessCode.scopeJson ? JSON.parse(accessCode.scopeJson) : []; } catch { throw new Error("نطاق كود المعلم غير صالح"); }
      if (!Array.isArray(embeddedScopes) || embeddedScopes.some((scope: any) => scope?.scopeType !== "circle" || scope?.scopeId !== accessCode.circleId)) throw new Error("كود المعلم لا يمكن أن يمنح سوى نطاق الحلقة المعينة");
      const [existingTeacher] = await tx.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.userId, input.userId), eq(teachers.centerId, accessCode.centerId), isNull(teachers.deletedAt))).limit(1);
      if (existingTeacher) {
        const existingTeacherCircles = await tx.select({ id: circles.id }).from(circles).where(and(or(eq(circles.teacherId, existingTeacher.id), eq(circles.assistantTeacherId, existingTeacher.id)), isNull(circles.deletedAt)));
        if (existingTeacherCircles.some((circle) => circle.id !== accessCode.circleId)) throw new Error("هذا الحساب مرتبط بحلقة معلم أخرى ولا يمكن منحه حلقة إضافية");
      }
      const [targetCircle] = await tx.select().from(circles).where(and(eq(circles.id, accessCode.circleId), isNull(circles.deletedAt))).limit(1);
      if (!targetCircle) throw new Error("الحلقة المرتبطة بالكود لم تعد متاحة");
      const occupiedTeacherId = accessCode.role === "teacher" ? targetCircle.teacherId : targetCircle.assistantTeacherId;
      if (occupiedTeacherId && occupiedTeacherId !== existingTeacher?.id) throw new Error("مقعد المعلم في الحلقة مرتبط بحساب آخر");
    }
    let embeddedScopes: unknown[] = [];
    try { embeddedScopes = accessCode.scopeJson ? JSON.parse(accessCode.scopeJson) : []; } catch { throw new Error("نطاق كود الدخول غير صالح"); }
    if (isGuideAccessCode) {
      const guideCircleIds = embeddedScopes
        .filter((scope: any) => scope?.scopeType === "circle" && typeof scope?.scopeId === "number")
        .map((scope: any) => scope.scopeId as number);
      const uniqueGuideCircleIds = Array.from(new Set(guideCircleIds));
      if (accessCode.maxUses !== 1 || uniqueGuideCircleIds.length === 0 || uniqueGuideCircleIds.length !== embeddedScopes.length) throw new Error("كود الموجّه غير صالح؛ يلزم حلقات محددة واستخدام واحد");
      const guideCircles = await tx.select({ id: circles.id, centerId: branches.centerId }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(circles.id, uniqueGuideCircleIds), isNull(circles.deletedAt)));
      if (guideCircles.length !== uniqueGuideCircleIds.length || guideCircles.some((circle) => circle.centerId !== accessCode.centerId)) throw new Error("نطاق حلقات الموجّه غير صالح أو خارج المركز");
    }
    if (isReaderAccessCode) {
      if (!accessCode.studentId || accessCode.maxUses !== 1) throw new Error("كود الطالب أو ولي الأمر غير صالح؛ يلزم طالب واحد واستخدام واحد");
      const readerScopes = embeddedScopes.filter((scope: any) => scope?.scopeType === "student" && scope?.scopeId === accessCode.studentId);
      if (readerScopes.length !== 1 || embeddedScopes.length !== 1) throw new Error("كود الطالب أو ولي الأمر لا يمكن أن يمنح سوى طالب واحد");
      const [targetStudent] = await tx.select().from(students).where(and(eq(students.id, accessCode.studentId), eq(students.centerId, accessCode.centerId), isNull(students.deletedAt))).limit(1);
      if (!targetStudent) throw new Error("الطالب المرتبط بالكود لم يعد متاحاً");
      if (accessCode.role === "student") {
        if (targetStudent.userId && targetStudent.userId !== input.userId) throw new Error("هذا الطالب مرتبط بحساب طالب آخر");
        const linkedStudents = await tx.select({ id: students.id }).from(students).where(and(eq(students.userId, input.userId), eq(students.centerId, accessCode.centerId), isNull(students.deletedAt)));
        if (linkedStudents.some((student) => student.id !== accessCode.studentId)) throw new Error("هذا الحساب مرتبط بطالب آخر ولا يمكن منحه طالباً إضافياً");
      } else {
        if (targetStudent.guardianUserId && targetStudent.guardianUserId !== input.userId) throw new Error("هذا الطالب مرتبط بولي أمر آخر");
        const [linkedParent] = await tx.select({ studentId: parentStudentLinks.studentId }).from(parentStudentLinks).where(and(eq(parentStudentLinks.guardianUserId, input.userId), eq(parentStudentLinks.centerId, accessCode.centerId))).limit(1);
        if (linkedParent && linkedParent.studentId !== accessCode.studentId) throw new Error("هذا الحساب مرتبط بابن آخر ولا يمكن منحه نطاقاً إضافياً");
        const linkedGuardianStudents = await tx.select({ id: students.id }).from(students).where(and(eq(students.guardianUserId, input.userId), eq(students.centerId, accessCode.centerId), isNull(students.deletedAt)));
        if (linkedGuardianStudents.some((student) => student.id !== accessCode.studentId)) throw new Error("هذا الحساب مرتبط بابن آخر ولا يمكن منحه نطاقاً إضافياً");
      }
    }
    const nextCount = accessCode.usedCount + 1;
    const claim = await tx.update(accessCodes).set({ usedCount: sql`${accessCodes.usedCount} + 1`, assignedUserId: input.userId, failedAttempts: 0, lockedUntil: null, lastUsedAt: now, status: nextCount >= accessCode.maxUses ? "used" : "active", updatedAt: now }).where(and(eq(accessCodes.id, accessCode.id), eq(accessCodes.status, "active"), lt(accessCodes.usedCount, accessCodes.maxUses)));
    if (!claim[0]?.affectedRows) throw new Error("تعذر استرداد الرمز؛ حاول مجدداً");

    await tx.update(users).set({ role: accessCode.role, isActive: true, accountStatus: "active", accessRevokedAt: null, lastActiveAt: now, updatedAt: now }).where(eq(users.id, input.userId));
    await tx.insert(centerMemberships).values({ userId: input.userId, centerId: accessCode.centerId, role: accessCode.role, status: "active", isOwner: false, grantedBy: accessCode.createdBy, grantedAt: now }).onDuplicateKeyUpdate({ set: { role: accessCode.role, status: "active", revokedAt: null, expiresAt: null, updatedAt: now } });

    const scopes: { scopeType: "center" | "circle" | "teacher" | "student"; scopeId?: number }[] = isTeacherAccessCode
      ? [{ scopeType: "circle", scopeId: accessCode.circleId! }]
      : isReaderAccessCode
        ? [{ scopeType: "student", scopeId: accessCode.studentId! }]
        : isGuideAccessCode
          ? (embeddedScopes as { scopeType: "circle"; scopeId: number }[])
          : [];
    if (!isTeacherAccessCode && !isReaderAccessCode && !isGuideAccessCode) {
      if (accessCode.circleId) scopes.push({ scopeType: "circle", scopeId: accessCode.circleId });
      if (accessCode.teacherId) scopes.push({ scopeType: "teacher", scopeId: accessCode.teacherId });
      if (accessCode.studentId) scopes.push({ scopeType: "student", scopeId: accessCode.studentId });
      try {
        const embedded = accessCode.scopeJson ? JSON.parse(accessCode.scopeJson) : [];
        if (Array.isArray(embedded)) for (const scope of embedded) if (["center", "circle", "teacher", "student"].includes(scope?.scopeType)) scopes.push({ scopeType: scope.scopeType, scopeId: scope.scopeId });
      } catch { /* مخطط النطاق غير صالح؛ يظل الرمز بنطاقه الصريح فقط. */ }
    }
    if (isTeacherAccessCode || isReaderAccessCode || isGuideAccessCode) await tx.update(userScopes).set({ revokedAt: now }).where(and(eq(userScopes.userId, input.userId), eq(userScopes.centerId, accessCode.centerId), isNull(userScopes.revokedAt)));
    if (scopes.length) await tx.insert(userScopes).values(scopes.map((scope) => ({ userId: input.userId, centerId: accessCode.centerId, scopeType: scope.scopeType, scopeId: scope.scopeId ?? null, grantedBy: accessCode.createdBy })));
    if (isTeacherAccessCode) {
      const [existingTeacher] = await tx.select().from(teachers).where(and(eq(teachers.userId, input.userId), eq(teachers.centerId, accessCode.centerId), isNull(teachers.deletedAt))).limit(1);
      const teacherId = existingTeacher?.id ?? Number((await tx.insert(teachers).values({ userId: input.userId, centerId: accessCode.centerId, name: "معلم جديد", isActive: true }))[0].insertId);
      await tx.update(teachers).set({ userId: input.userId, isActive: true, updatedAt: now }).where(eq(teachers.id, teacherId));
      await tx.update(circles).set(accessCode.role === "teacher" ? { teacherId } : { assistantTeacherId: teacherId }).where(eq(circles.id, accessCode.circleId!));
    }
    if (accessCode.studentId && accessCode.role === "student") await tx.update(students).set({ userId: input.userId, isActive: true, updatedAt: now }).where(and(eq(students.id, accessCode.studentId), eq(students.centerId, accessCode.centerId)));
    if (accessCode.studentId && accessCode.role === "guardian") {
      await tx.update(students).set({ guardianUserId: input.userId, updatedAt: now }).where(and(eq(students.id, accessCode.studentId), eq(students.centerId, accessCode.centerId)));
      await tx.insert(parentStudentLinks).values({ guardianUserId: input.userId, studentId: accessCode.studentId, centerId: accessCode.centerId, linkedBy: accessCode.createdBy }).onDuplicateKeyUpdate({ set: { centerId: accessCode.centerId } });
    }
    const [center] = await tx.select({ managerId: centers.managerId, name: centers.name }).from(centers).where(eq(centers.id, accessCode.centerId)).limit(1);
    const managers = await tx.select({ userId: centerMemberships.userId }).from(centerMemberships).where(and(eq(centerMemberships.centerId, accessCode.centerId), eq(centerMemberships.status, "active"), isNull(centerMemberships.revokedAt), or(eq(centerMemberships.role, "center_manager"), eq(centerMemberships.isOwner, true))));
    const managerIds = Array.from(new Set([center?.managerId, ...managers.map((manager) => manager.userId)].filter((id): id is number => typeof id === "number")));
    const [redeemingUser] = await tx.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
    const roleLabel = ({ supervisor: "مشرف", guide: "موجّه", teacher: "معلم", assistant_teacher: "معلم مساعد", student: "طالب", guardian: "ولي أمر" } as Record<string, string>)[accessCode.role] ?? accessCode.role;
    if (managerIds.length) await tx.insert(notifications).values(managerIds.map((userId) => ({ userId, title: "تم استخدام كود دخول", message: `استرد ${redeemingUser?.name || redeemingUser?.email || "مستخدم"} كود دخول بدور ${roleLabel} في مركز ${center?.name || accessCode.centerId}.`, type: "success" as const, relatedId: accessCode.id, relatedType: "access_code_redeemed" })));
    await tx.insert(notifications).values({ userId: input.userId, title: "تم تفعيل الوصول", message: "تم تفعيل حسابك بالدور والنطاق الممنوحين من المركز.", type: "success", relatedId: accessCode.id, relatedType: "access_code" });
    await tx.insert(accessCodeAttempts).values({ accessCodeId: accessCode.id, codeFingerprint: input.codeHash, attemptedByUserId: input.userId, wasSuccessful: true, ipAddress: input.ipAddress, userAgent: input.userAgent });
    return { centerId: accessCode.centerId, role: accessCode.role, status: nextCount >= accessCode.maxUses ? "used" : "active" };
  });
}
