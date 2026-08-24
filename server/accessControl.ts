import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import {
  getActiveCenterMembership,
  getActivePermissionGrants,
  getActiveUserScopes,
  getCenterIdForCircle,
  getCenterIdForStudent,
  getCircleIdsForTeacher,
  getParentStudentLinks,
  getStudentByUserId,
  getTeacherByUserId,
} from "./db";
import type { GranularPermission } from "../shared/permissions";

type CenterRole = "center_manager" | "supervisor" | "guide" | "teacher" | "assistant_teacher" | "student" | "guardian";
export type AccessSubject = Pick<User, "id" | "isActive" | "accountStatus" | "accessRevokedAt"> & { role: string };

const ALL: readonly GranularPermission[] = [
  "center.view", "center.edit", "users.view", "users.create", "users.edit", "users.delete",
  "supervisors.view", "supervisors.create", "supervisors.edit", "supervisors.delete",
  "teachers.view", "teachers.create", "teachers.edit", "teachers.delete", "guides.view", "guides.create", "guides.edit", "guides.delete",
  "circles.view", "circles.create", "circles.edit", "circles.delete", "circles.assign_teacher",
  "students.view", "students.create", "students.edit", "students.delete", "students.transfer",
  "parents.view", "parents.create", "parents.edit", "parents.delete", "parents.link_children",
  "attendance.view", "attendance.create", "attendance.edit", "reports.view", "reports.export",
  "access_codes.view", "access_codes.create", "access_codes.revoke", "settings.view", "settings.edit", "audit_logs.view",
];

export const ROLE_PERMISSION_TEMPLATES: Record<CenterRole, readonly GranularPermission[]> = {
  center_manager: ALL,
  supervisor: ["center.view", "users.view", "teachers.view", "teachers.create", "teachers.edit", "guides.view", "circles.view", "circles.create", "circles.edit", "circles.assign_teacher", "students.view", "students.create", "students.edit", "students.transfer", "parents.view", "parents.create", "parents.edit", "parents.link_children", "attendance.view", "attendance.create", "attendance.edit", "reports.view", "reports.export", "access_codes.view", "access_codes.create", "access_codes.revoke"],
  guide: ["circles.view", "students.view", "attendance.view", "reports.view"],
  teacher: ["circles.view", "students.view", "students.create", "students.edit", "students.delete", "parents.view", "parents.create", "parents.link_children", "attendance.view", "attendance.create", "attendance.edit", "reports.view", "reports.export", "access_codes.view", "access_codes.create", "access_codes.revoke"],
  assistant_teacher: ["circles.view", "students.view", "attendance.view", "attendance.create", "attendance.edit", "reports.view"],
  student: ["students.view", "reports.view"],
  guardian: ["students.view", "reports.view"],
};

function forbidden(message = "لا تملك صلاحية تنفيذ هذا الإجراء") { return new TRPCError({ code: "FORBIDDEN", message }); }
function isCenterRole(value: string): value is CenterRole { return value in ROLE_PERMISSION_TEMPLATES; }

export async function getAuthorization(user: AccessSubject, centerId: number) {
  if (!user.isActive || user.accountStatus !== "active" || user.accessRevokedAt) throw forbidden("حسابك غير نشط");
  const membership = await getActiveCenterMembership(user.id, centerId);
  if (!membership || !isCenterRole(membership.role)) throw forbidden("لا تملك عضوية نشطة في هذا المركز");
  const [grants, scopes] = await Promise.all([getActivePermissionGrants(user.id, centerId), getActiveUserScopes(user.id, centerId)]);
  const permissions = new Set<GranularPermission>(ROLE_PERMISSION_TEMPLATES[membership.role]);
  for (const grant of grants) {
    if (grant.effect === "deny") permissions.delete(grant.permission as GranularPermission);
    else permissions.add(grant.permission as GranularPermission);
  }
  return { membership, permissions, scopes };
}

export async function hasPermission(user: AccessSubject, centerId: number, permission: GranularPermission) {
  return (await getAuthorization(user, centerId)).permissions.has(permission);
}

export async function assertPermission(user: AccessSubject, centerId: number, permission: GranularPermission) {
  const authorization = await getAuthorization(user, centerId);
  if (!authorization.permissions.has(permission)) throw forbidden();
  return authorization;
}

export async function assertScope(user: AccessSubject, centerId: number, resource: { circleId?: number | null; teacherId?: number | null; studentId?: number | null }) {
  const authorization = await getAuthorization(user, centerId);
  if (authorization.membership.isOwner || authorization.scopes.some((scope) => scope.scopeType === "center")) return authorization;
  const allowed = authorization.scopes.some((scope) =>
    (scope.scopeType === "circle" && resource.circleId != null && scope.scopeId === resource.circleId)
    || (scope.scopeType === "teacher" && resource.teacherId != null && scope.scopeId === resource.teacherId)
    || (scope.scopeType === "student" && resource.studentId != null && scope.scopeId === resource.studentId),
  );
  if (allowed) return authorization;

  if (authorization.membership.role === "teacher" || authorization.membership.role === "assistant_teacher") {
    const teacher = await getTeacherByUserId(user.id);
    const circles = teacher ? await getCircleIdsForTeacher(teacher.id) : [];
    if (resource.circleId != null && circles.includes(resource.circleId)) return authorization;
  }
  if (authorization.membership.role === "student" && resource.studentId != null) {
    const student = await getStudentByUserId(user.id);
    if (student?.id === resource.studentId) return authorization;
  }
  if (authorization.membership.role === "guardian" && resource.studentId != null) {
    const links = await getParentStudentLinks(user.id, centerId);
    if (links.some((link) => link.studentId === resource.studentId)) return authorization;
  }
  throw forbidden("هذا المورد خارج نطاق وصولك");
}

export async function assertCirclePermission(user: AccessSubject, circleId: number, permission: GranularPermission) {
  const centerId = await getCenterIdForCircle(circleId);
  if (!centerId) throw new TRPCError({ code: "NOT_FOUND", message: "الحلقة غير موجودة" });
  await assertPermission(user, centerId, permission);
  return assertScope(user, centerId, { circleId });
}

export async function assertStudentPermission(user: AccessSubject, studentId: number, permission: GranularPermission, circleId?: number | null) {
  const centerId = await getCenterIdForStudent(studentId);
  if (!centerId) throw new TRPCError({ code: "NOT_FOUND", message: "الطالب غير موجود" });
  await assertPermission(user, centerId, permission);
  return assertScope(user, centerId, { studentId, circleId });
}

/** لا يستطيع المفوض منح إذن أو نطاق غير فعّال في تفويضه الحالي. */
export async function assertCanDelegate(user: AccessSubject, centerId: number, permissions: readonly GranularPermission[], scopeIds: readonly number[]) {
  const authorization = await getAuthorization(user, centerId);
  if (authorization.membership.isOwner) return authorization;
  if (permissions.some((permission) => !authorization.permissions.has(permission))) throw forbidden("لا يمكنك منح صلاحية لا تملكها");
  const fullCenterScope = authorization.scopes.some((scope) => scope.scopeType === "center");
  if (!fullCenterScope && scopeIds.some((id) => !authorization.scopes.some((scope) => scope.scopeId === id))) throw forbidden("لا يمكنك تفويض نطاق خارج صلاحيتك");
  return authorization;
}
