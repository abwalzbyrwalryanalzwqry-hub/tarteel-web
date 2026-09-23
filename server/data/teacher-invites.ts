import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import {
  circles,
  teacherInvites,
  teachers,
  users,
} from "../../drizzle/schema";
import { getTeacherInviteAvailability } from "../../shared/teacherInvites";
import { getDb } from "./connection";

// ===================== TEACHER INVITES =====================
export async function getTeacherInvites(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (centerId) {
    return db.select().from(teacherInvites).where(eq(teacherInvites.centerId, centerId)).orderBy(desc(teacherInvites.createdAt));
  }
  return db.select().from(teacherInvites).orderBy(desc(teacherInvites.createdAt));
}

export async function createTeacherInvite(data: typeof teacherInvites.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(teacherInvites).values(data);
}

export async function getTeacherInviteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teacherInvites).where(eq(teacherInvites.id, id)).limit(1);
  return result[0];
}

export async function revokeTeacherInvite(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teacherInvites).set({ isRevoked: true }).where(eq(teacherInvites.id, id));
}

/** يسترد دعوة معلم صالحة مرة واحدة ويحدّث دور المستخدم وربطه بالحَلَقة ضمن معاملة واحدة. */
export async function redeemTeacherInvite(code: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const normalizedCode = code.trim().toUpperCase();

  return db.transaction(async (tx) => {
    const [invite] = await tx.select().from(teacherInvites).where(eq(teacherInvites.code, normalizedCode)).limit(1);
    if (!invite) throw new Error("رمز الدعوة غير صحيح");
    const availability = getTeacherInviteAvailability(invite);
    if (availability === "revoked") throw new Error("تم إلغاء هذه الدعوة");
    if (availability === "used") throw new Error("تم استخدام هذه الدعوة مسبقاً");
    if (availability === "expired") throw new Error("انتهت صلاحية هذه الدعوة");

    const [circle] = await tx.select().from(circles).where(and(eq(circles.id, invite.circleId), isNull(circles.deletedAt))).limit(1);
    if (!circle) throw new Error("الحَلَقة المرتبطة بالدعوة لم تعد متاحة");
    const assignedTeacherId = invite.role === "teacher" ? circle.teacherId : circle.assistantTeacherId;
    if (assignedTeacherId) throw new Error("هذا المقعد في الحَلَقة مرتبط بمعلم بالفعل");

    const claim = await tx.update(teacherInvites)
      .set({ usedAt: new Date(), usedByUserId: userId })
      .where(and(
        eq(teacherInvites.id, invite.id),
        isNull(teacherInvites.usedAt),
        eq(teacherInvites.isRevoked, false),
        or(isNull(teacherInvites.expiresAt), gt(teacherInvites.expiresAt, new Date())),
      ));
    if (!claim[0]?.affectedRows) throw new Error("تعذر استرداد الدعوة؛ ربما استُخدمت للتو");

    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("حساب المستخدم غير موجود");
    const [existingTeacher] = await tx.select().from(teachers).where(and(eq(teachers.userId, userId), isNull(teachers.deletedAt))).limit(1);
    if (existingTeacher) {
      const existingTeacherCircles = await tx.select({ id: circles.id }).from(circles).where(and(or(eq(circles.teacherId, existingTeacher.id), eq(circles.assistantTeacherId, existingTeacher.id)), isNull(circles.deletedAt)));
      if (existingTeacherCircles.some((circle) => circle.id !== invite.circleId)) throw new Error("هذا الحساب مرتبط بحلقة معلم أخرى ولا يمكن منحه حلقة إضافية");
    }
    const teacherId = existingTeacher?.id ?? Number((await tx.insert(teachers).values({
      userId,
      centerId: invite.centerId,
      name: user.name?.trim() || "معلم جديد",
      email: user.email,
      isActive: true,
    }))[0].insertId);

    await tx.update(users).set({ role: invite.role }).where(eq(users.id, userId));
    await tx.update(circles).set(invite.role === "teacher" ? { teacherId } : { assistantTeacherId: teacherId }).where(eq(circles.id, invite.circleId));
    return { centerId: invite.centerId, circleId: invite.circleId, role: invite.role };
  });
}
