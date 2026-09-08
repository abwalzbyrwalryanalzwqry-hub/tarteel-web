import type { LocalSession } from "./localSession";

export type LocalResource = {
  centerId?: string | null;
  circleId?: string | null;
  teacherId?: string | null;
  studentId?: string | null;
};

export type LocalAction = "read" | "create" | "update" | "delete" | "export";

const unrestrictedRoles = new Set(["super_admin", "org_admin"]);
const centerRoles = new Set(["center_manager", "supervisor"]);
const teacherRoles = new Set(["teacher", "assistant_teacher"]);
const readOnlyRoles = new Set(["student", "guardian"]);

export function canAccessResource(session: LocalSession, resource: LocalResource, action: LocalAction): boolean {
  if (session.roles.some((role) => unrestrictedRoles.has(role))) return true;

  const scopes = session.scopes.filter((scope) => scope.scopeId !== null);
  const hasCenterScope = resource.centerId ? scopes.some((scope) => scope.scopeType === "center" && scope.scopeId === resource.centerId) : false;
  const hasCircleScope = resource.circleId ? scopes.some((scope) => scope.scopeType === "circle" && scope.scopeId === resource.circleId) : false;
  const hasTeacherScope = resource.teacherId ? scopes.some((scope) => scope.scopeType === "teacher" && scope.scopeId === resource.teacherId) : false;
  const hasStudentScope = resource.studentId ? scopes.some((scope) => scope.scopeType === "student" && scope.scopeId === resource.studentId) : false;

  if (session.roles.some((role) => centerRoles.has(role))) return hasCenterScope;
  if (session.roles.some((role) => teacherRoles.has(role))) return hasCircleScope || hasTeacherScope;
  if (session.roles.some((role) => readOnlyRoles.has(role))) return action === "read" && hasStudentScope;
  return false;
}

export function assertCanAccessResource(session: LocalSession, resource: LocalResource, action: LocalAction): void {
  if (!canAccessResource(session, resource, action)) {
    throw new Error("لا تملك صلاحية الوصول إلى هذا النطاق أو تنفيذ هذا الإجراء");
  }
}
