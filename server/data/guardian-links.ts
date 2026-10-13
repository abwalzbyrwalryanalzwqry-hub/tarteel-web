/**
 * ربط ولي الأمر تلقائياً بكل أبنائه المسجلين برقم هاتفه.
 *
 * يُستدعى بعد إثبات امتلاك الرقم (واتساب أو SMS)، وعند إضافة طالب أو تعديل رقم ولي أمره إن كان
 * للرقم حساب مؤكد. القواعد:
 *  - الرقم المؤكد فقط: رقم غير مؤكد قد يملكه شخص آخر.
 *  - الحساب بلا دور بعد (user) أو ولي أمر (guardian)؛ لا نغيّر دور معلم أو مدير.
 *  - الطالب المرتبط بولي أمر آخر لا يُنقل.
 *  - في كل مركز: تُنشأ عضوية ولي أمر نشطة إن لم توجد عضوية. العضوية الموقوفة أو المسحوبة أو
 *    بدور آخر تبقى كما هي، فلا يُعاد وصول سحبه المركز.
 */
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { logger } from "../_core/logger";
import {
  auditLog,
  centerMemberships,
  centers,
  localCredentials,
  notifications,
  parentStudentLinks,
  students,
  users,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { normalizePhone } from "../../shared/phone";
import { getDb } from "./connection";

const LINKABLE_ROLES = new Set(["user", "guardian"]);

/** يوحّد رقم ولي الأمر المدخل من المركز؛ يُبقي النص كما هو إن لم يكن رقماً صالحاً. */
export function normalizeGuardianPhone(raw: string | null | undefined) {
  if (raw == null) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return normalizePhone(trimmed, ENV.phoneDefaultCountryCode) ?? trimmed;
}

export type GuardianLinkResult = {
  linked: number;
  studentIds: number[];
  centerIds: number[];
};

export async function linkGuardianChildrenByPhone(
  userId: number,
  phone: string,
  options: { centerId?: number; linkedBy?: number | null } = {}
): Promise<GuardianLinkResult> {
  const empty: GuardianLinkResult = {
    linked: 0,
    studentIds: [],
    centerIds: [],
  };
  const db = await getDb();
  if (!db) return empty;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return empty;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.deletedAt || !LINKABLE_ROLES.has(user.role)) return empty;

  // مطابقة أولية بآخر 7 أرقام بعد حذف المسافات والشرطات و+، ثم مطابقة دقيقة بعد التوحيد.
  const stripped = sql`REPLACE(REPLACE(REPLACE(${students.guardianPhone}, ' ', ''), '-', ''), '+', '')`;
  const conditions = [
    isNull(students.deletedAt),
    sql`${stripped} LIKE ${`%${digits.slice(-7)}`}`,
    or(isNull(students.guardianUserId), eq(students.guardianUserId, userId)),
  ];
  if (options.centerId)
    conditions.push(eq(students.centerId, options.centerId));
  const candidates = (
    await db
      .select({
        id: students.id,
        centerId: students.centerId,
        name: students.name,
        guardianPhone: students.guardianPhone,
      })
      .from(students)
      .where(and(...conditions))
  ).filter(
    student =>
      student.guardianPhone &&
      normalizePhone(student.guardianPhone, ENV.phoneDefaultCountryCode) ===
        phone
  );
  if (!candidates.length) return empty;

  const now = new Date();
  const linkedBy = options.linkedBy ?? null;
  return db.transaction(async tx => {
    const result: GuardianLinkResult = {
      linked: 0,
      studentIds: [],
      centerIds: [],
    };
    const centerIds = Array.from(new Set(candidates.map(s => s.centerId)));
    for (const centerId of centerIds) {
      const [membership] = await tx
        .select()
        .from(centerMemberships)
        .where(
          and(
            eq(centerMemberships.userId, userId),
            eq(centerMemberships.centerId, centerId)
          )
        )
        .limit(1);
      if (membership) {
        const usable =
          membership.role === "guardian" &&
          membership.status === "active" &&
          !membership.revokedAt;
        if (!usable) continue;
      } else {
        await tx.insert(centerMemberships).values({
          userId,
          centerId,
          role: "guardian",
          status: "active",
          isOwner: false,
          grantedBy: linkedBy,
          grantedAt: now,
        });
      }
      const centerStudents = candidates.filter(s => s.centerId === centerId);
      const newlyLinked: typeof centerStudents = [];
      for (const student of centerStudents) {
        await tx
          .update(students)
          .set({ guardianUserId: userId, updatedAt: now })
          .where(
            and(
              eq(students.id, student.id),
              or(
                isNull(students.guardianUserId),
                eq(students.guardianUserId, userId)
              )
            )
          );
        const existing = await tx
          .select({ id: parentStudentLinks.id })
          .from(parentStudentLinks)
          .where(
            and(
              eq(parentStudentLinks.guardianUserId, userId),
              eq(parentStudentLinks.studentId, student.id)
            )
          )
          .limit(1);
        if (existing.length) continue;
        await tx
          .insert(parentStudentLinks)
          .values({
            guardianUserId: userId,
            studentId: student.id,
            centerId,
            linkedBy,
          })
          .onDuplicateKeyUpdate({ set: { centerId } });
        newlyLinked.push(student);
      }
      if (!newlyLinked.length) continue;
      result.centerIds.push(centerId);
      result.studentIds.push(...newlyLinked.map(s => s.id));
      result.linked += newlyLinked.length;
      await tx.insert(auditLog).values(
        newlyLinked.map(student => ({
          userId: linkedBy ?? userId,
          centerId,
          action: "guardian.auto_linked",
          entity: "student",
          entityId: student.id,
          newData: JSON.stringify({
            guardianUserId: userId,
            by: "verified_phone",
          }),
        }))
      );
      // إشعار إدارة المركز: الربط تلقائي، فيحق لها أن تعرف وأن تراجعه.
      const [center] = await tx
        .select({ managerId: centers.managerId, name: centers.name })
        .from(centers)
        .where(eq(centers.id, centerId))
        .limit(1);
      const managers = await tx
        .select({ userId: centerMemberships.userId })
        .from(centerMemberships)
        .where(
          and(
            eq(centerMemberships.centerId, centerId),
            eq(centerMemberships.status, "active"),
            isNull(centerMemberships.revokedAt),
            or(
              eq(centerMemberships.role, "center_manager"),
              eq(centerMemberships.isOwner, true)
            )
          )
        );
      const managerIds = Array.from(
        new Set(
          [center?.managerId, ...managers.map(m => m.userId)].filter(
            (id): id is number => typeof id === "number" && id !== linkedBy
          )
        )
      );
      const names = newlyLinked.map(s => s.name).join("، ");
      if (managerIds.length)
        await tx.insert(notifications).values(
          managerIds.map(managerId => ({
            userId: managerId,
            title: "ربط ولي أمر برقم هاتفه",
            message: `رُبط حساب ${user.name || phone} (رقم مؤكد) تلقائياً بالطلاب: ${names}، لأن رقمه مسجل رقماً لولي أمرهم في مركز ${center?.name || centerId}.`,
            type: "info" as const,
            relatedId: userId,
            relatedType: "guardian_auto_linked",
          }))
        );
      await tx.insert(notifications).values({
        userId,
        title: "تم ربط أبنائك",
        message: `يمكنك الآن متابعة إنجاز: ${names}.`,
        type: "success",
        relatedId: centerId,
        relatedType: "guardian_auto_linked",
      });
    }
    if (result.linked && user.role === "user")
      await tx
        .update(users)
        .set({ role: "guardian", lastActiveAt: now, updatedAt: now })
        .where(eq(users.id, userId));
    return result;
  });
}

/**
 * بعد إضافة طالب أو تعديل رقم ولي أمره: إن كان للرقم حساب مؤكد، يُربط بأبنائه في هذا المركز.
 * فشل الربط لا يُفشل حفظ الطالب.
 */
export async function autoLinkGuardianByPhone(
  guardianPhone: string | null | undefined,
  centerId: number,
  linkedBy: number
) {
  if (!guardianPhone || !guardianPhone.startsWith("+")) return null;
  try {
    const db = await getDb();
    if (!db) return null;
    const [credential] = await db
      .select({ userId: localCredentials.userId })
      .from(localCredentials)
      .where(
        and(
          eq(localCredentials.phone, guardianPhone),
          isNotNull(localCredentials.phoneVerifiedAt)
        )
      )
      .limit(1);
    if (!credential) return null;
    return await linkGuardianChildrenByPhone(credential.userId, guardianPhone, {
      centerId,
      linkedBy,
    });
  } catch (error) {
    logger.warn(
      { err: error },
      "[Guardian] auto-link after student save failed"
    );
    return null;
  }
}
