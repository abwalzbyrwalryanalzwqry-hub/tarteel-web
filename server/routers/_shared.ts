/** أدوات تحقق مشتركة بين موجّهات tRPC (نُقلت كما هي من server/routers.ts). */
import { TRPCError } from "@trpc/server";

import { assertCirclePermission, assertPermission, assertStudentPermission, type AccessSubject } from "../accessControl";


import {
  getCircleById,
  getCircleIdsForTeacher,
  getCircles,
  getParentStudentLinks,
  getStudentById,
  getStudentByUserId,
  getStudents,
  getStudentsByGuardianUserId,
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


export async function assertStudentManageAccess(user: AccessSubject, circleId: number | null | undefined, permission: "students.create" | "students.edit" | "students.delete", centerId?: number) {
  if (circleId) return assertCirclePermission(user, circleId, permission);
  if (TEACHING_ROLES.has(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم ربط الطالب بحلقة المعلم عند الإنشاء أو الإدارة" });
  if (!centerId) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم تحديد المركز أو الحلقة" });
  return assertPermission(user, centerId, permission);
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

/** الطلاب الذين يحق للمستخدم قراءة سجلاتهم (منطق students.list نفسه، ويستعمله سجل الصفحة في المصحف). */
export async function listReadableStudents(user: AccessSubject, input: { centerId?: number; circleId?: number; search?: string }) {
  if (user.role === "student") {
    const student = await getStudentByUserId(user.id);
    if (!student) return [];
    await assertStudentReadAccess(user, student);
    return [toReaderStudent(student)];
  }
  if (user.role === "guardian") {
    const linked = await getStudentsByGuardianUserId(user.id);
    const permitted = await Promise.all(linked.map(async (student) => { try { await assertStudentReadAccess(user, student); return student; } catch { return null; } }));
    return permitted.filter((student): student is NonNullable<typeof student> => Boolean(student)).map(toReaderStudent);
  }
  const scope = await getTeacherCircleScope(user);
  if (!scope) {
    if (input.circleId) { await assertCirclePermission(user, input.circleId, "students.view"); return getStudents(undefined, input.circleId, input.search); }
    const centerIds = input.centerId ? [input.centerId] : await getAccessibleCenterIds(user, "students.view");
    if (input.centerId) await assertPermission(user, input.centerId, "students.view");
    const candidates = (await Promise.all(centerIds.map((centerId) => getStudents(centerId, undefined, input.search)))).flat();
    const authorized = await Promise.all(candidates.map(async (student) => { try { await assertStudentPermission(user, student.id, "students.view", student.circleId); return student; } catch { return null; } }));
    return authorized.filter((student): student is NonNullable<typeof student> => Boolean(student));
  }
  if (input.circleId) {
    if (!scope.includes(input.circleId)) throw new TRPCError({ code: "FORBIDDEN" });
    return getStudents(undefined, input.circleId, input.search);
  }
  return (await Promise.all(scope.map((circleId) => getStudents(undefined, circleId, input.search)))).flat();
}
