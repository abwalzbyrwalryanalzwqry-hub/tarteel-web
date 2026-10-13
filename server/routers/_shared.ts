/** أدوات تحقق مشتركة بين موجّهات tRPC (نُقلت كما هي من server/routers.ts). */
import { TRPCError } from "@trpc/server";

import { assertCirclePermission, assertPermission, assertStudentPermission, type AccessSubject } from "../accessControl";
import { getQuranRangeError } from "../../shared/mizan";

import { getRiyadhDayKey } from "../../shared/dates";

import {
  createSession,
  getCircleById,
  getCircleIdsForTeacher,
  getCircles,
  getParentStudentLinks,
  getSessionById,
  getSessionByCircleDay,
  getStudentById,
  getStudentMizanProfile,
  getTeacherByUserId,
  getUserCenterMemberships,
} from "../db";

export const TEACHING_ROLES = new Set(["teacher", "assistant_teacher"]);

export async function getTeacherCircleScope(user: AccessSubject) {
  if (!TEACHING_ROLES.has(user.role)) return null;
  const teacher = await getTeacherByUserId(user.id);
  if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "لا يوجد ملف معلم مرتبط بحسابك" });
  return getCircleIdsForTeacher(teacher.id);
}

export async function assertTeacherCircleAccess(user: AccessSubject, circleId: number | null | undefined) {
  if (!circleId) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تحديد نطاق الحلقة" });
  await assertCirclePermission(user, circleId, "circles.view");
}

export async function getAuthorizedSession(user: AccessSubject, sessionId: number) {
  const session = await getSessionById(sessionId);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة" });
  await assertCirclePermission(user, session.circleId, "attendance.view");
  return session;
}

export async function assertSessionStudentMatch(user: AccessSubject, sessionId: number, studentId: number) {
  const [session, student] = await Promise.all([getAuthorizedSession(user, sessionId), getStudentById(studentId)]);
  if (!student || student.circleId !== session.circleId) throw new TRPCError({ code: "BAD_REQUEST", message: "الطالب لا ينتمي إلى حَلَقَة هذه الجلسة" });
  return { session, student };
}

export async function assertStudentReadAccess(user: AccessSubject, student: Awaited<ReturnType<typeof getStudentById>>) {
  if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "الطالب غير موجود" });
  // دفاع إضافي متوافق مع الروابط التاريخية؛ ثم تتحقق طبقة النطاق من روابط الأبناء المتعددة.
  if (user.role === "student" && student.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
  if (user.role === "guardian" && student.guardianUserId !== user.id) {
    const links = await getParentStudentLinks(user.id, student.centerId);
    if (!links.some((link) => link.studentId === student.id)) throw new TRPCError({ code: "FORBIDDEN" });
  }
  await assertStudentPermission(user, student.id, "reports.view", student.circleId);
  return student;
}

export function toReaderStudent(student: NonNullable<Awaited<ReturnType<typeof getStudentById>>>) {
  return {
    id: student.id,
    name: student.name,
    isActive: student.isActive,
    circleId: student.circleId,
    lastMemorizedSurah: student.lastMemorizedSurah,
    lastMemorizedAyah: student.lastMemorizedAyah,
    totalMemorizedJuz: student.totalMemorizedJuz,
    guardianName: null,
    guardianPhone: null,
    phone: null,
  };
}

export async function getStudentProfileForReader(user: AccessSubject, studentId: number, startDate?: Date, endDate?: Date) {
  const profile = await getStudentMizanProfile(studentId, startDate, endDate);
  if (!profile) return profile;
  if (user.role === "student") return { ...profile, student: toReaderStudent(profile.student), attendance: [], evaluations: [] };
  if (user.role === "guardian") return { ...profile, student: toReaderStudent(profile.student) };
  return profile;
}

export async function assertStudentManageAccess(user: AccessSubject, circleId: number | null | undefined, permission: "students.create" | "students.edit" | "students.delete", centerId?: number) {
  if (circleId) return assertCirclePermission(user, circleId, permission);
  if (TEACHING_ROLES.has(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم ربط الطالب بحلقة المعلم عند الإنشاء أو الإدارة" });
  if (!centerId) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم تحديد المركز أو الحلقة" });
  return assertPermission(user, centerId, permission);
}

export async function resolveSessionCreateInput(user: AccessSubject, input: { circleId: number; teacherId?: number; seasonId?: number; title?: string; type: "regular" | "exam" | "review" | "special"; scheduledAt: Date; notes?: string }) {
  const circle = await getCircleById(input.circleId);
  if (!circle) throw new TRPCError({ code: "NOT_FOUND", message: "الحلقة غير موجودة" });
  await assertCirclePermission(user, circle.id, "attendance.create");
  if (TEACHING_ROLES.has(user.role)) {
    const teacher = await getTeacherByUserId(user.id);
    if (!teacher || (circle.teacherId !== teacher.id && circle.assistantTeacherId !== teacher.id)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك إنشاء جلسة إلا في حلقتك المرتبطة بحسابك" });
    if (input.teacherId != null && input.teacherId !== teacher.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعيين معلم آخر لجلسة حلقتك" });
    if (input.seasonId != null && input.seasonId !== circle.seasonId) throw new TRPCError({ code: "BAD_REQUEST", message: "الموسم المحدد لا يطابق موسم الحلقة" });
    return { ...input, teacherId: teacher.id, seasonId: circle.seasonId };
  }
  if (!input.teacherId || !input.seasonId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم اختيار المعلم والموسم الدراسي" });
  return input as Required<Pick<typeof input, "teacherId" | "seasonId">> & typeof input;
}

/** يستخرج معرّف الإدراج من صيغ موصل MySQL/TiDB المتوافقة. */
export function getInsertedSessionId(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  const id = Number((header as { insertId?: unknown } | undefined)?.insertId);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** كل فترة تخص تاريخاً يحدده المعلم: يمنع السجل الثاني في الحلقة والتاريخ نفسيهما. */
export async function createDailyPeriod(user: AccessSubject, input: { circleId: number; teacherId?: number; seasonId?: number; title?: string; type: "regular" | "exam" | "review" | "special"; scheduledAt: Date; notes?: string }) {
  const resolved = await resolveSessionCreateInput(user, input);
  const dayKey = getRiyadhDayKey(resolved.scheduledAt);
  const existing = await getSessionByCircleDay(resolved.circleId, dayKey);
  if (existing) throw new TRPCError({ code: "CONFLICT", message: "توجد بالفعل فترة لهذه الحلقة في التاريخ المحدد. اختر يوماً أو تاريخاً آخر." });
  const insertion = await createSession({ ...resolved, dayKey });
  const insertedId = getInsertedSessionId(insertion);
  if (insertedId) return { sessionId: insertedId, periodId: insertedId } as const;
  const created = await getSessionByCircleDay(resolved.circleId, dayKey);
  if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر فتح سجل طلاب الفترة الجديدة" });
  return { sessionId: created.id, periodId: created.id } as const;
}

export function assertQuranRange(input: { surahNumber: number; toSurahNumber?: number; fromAyah: number; toAyah: number }) {
  const message = getQuranRangeError(input);
  if (message) throw new TRPCError({ code: "BAD_REQUEST", message });
}

export async function getAccessibleCenterIds(user: AccessSubject, permission: Parameters<typeof assertPermission>[2]) {
  const now = new Date();
  const memberships = await getUserCenterMemberships(user.id);
  const allowed = await Promise.all(memberships
    .filter((membership) => membership.status === "active" && !membership.revokedAt && (!membership.expiresAt || membership.expiresAt > now))
    .map(async (membership) => {
      try { await assertPermission(user, membership.centerId, permission); return membership.centerId; }
      catch { return null; }
    }));
  return allowed.filter((id): id is number => id != null);
}

export async function filterAccessibleCircles(user: AccessSubject, items: Awaited<ReturnType<typeof getCircles>>) {
  const access = await Promise.all(items.map(async (circle) => {
    try { await assertTeacherCircleAccess(user, circle.id); return true; } catch { return false; }
  }));
  return items.filter((_, index) => access[index]);
}

export async function getAccessibleDashboardCircleIds(user: AccessSubject) {
  const circles = await getCircles();
  const allowed = await filterAccessibleCircles(user, circles);
  return allowed.map((circle) => circle.id);
}
