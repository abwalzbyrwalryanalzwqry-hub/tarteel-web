export type TarteelRole =
  | "super_admin"
  | "org_admin"
  | "center_manager"
  | "supervisor"
  | "guide"
  | "teacher"
  | "assistant_teacher"
  | "student"
  | "guardian"
  | "admin"
  | "user";

export type TarteelPermission =
  | "dashboard:view"
  | "centers:manage"
  | "branches:manage"
  | "seasons:manage"
  | "circles:view"
  | "circles:manage"
  | "teachers:manage"
  | "students:view"
  | "students:manage"
  | "sessions:view"
  | "sessions:manage"
  | "reports:view"
  | "settings:view"
  | "settings:manage"
  | "notifications:view"
  | "audit:view"
  | "trash:manage"
  | "ai:use"
  | "quran:view"
  | "messages:manage";

/** مفردات الصلاحيات التفصيلية المحفوظة في قاعدة البيانات؛ تبقى مفاتيح التنقل القديمة متوافقة. */
export const GRANULAR_PERMISSIONS = [
  "center.view", "center.edit", "users.view", "users.create", "users.edit", "users.delete",
  "supervisors.view", "supervisors.create", "supervisors.edit", "supervisors.delete",
  "teachers.view", "teachers.create", "teachers.edit", "teachers.delete",
  "guides.view", "guides.create", "guides.edit", "guides.delete",
  "circles.view", "circles.create", "circles.edit", "circles.delete", "circles.assign_teacher",
  "students.view", "students.create", "students.edit", "students.delete", "students.transfer",
  "parents.view", "parents.create", "parents.edit", "parents.delete", "parents.link_children",
  "attendance.view", "attendance.create", "attendance.edit", "reports.view", "reports.export",
  "access_codes.view", "access_codes.create", "access_codes.revoke", "settings.view", "settings.edit", "audit_logs.view",
] as const;
export type GranularPermission = (typeof GRANULAR_PERMISSIONS)[number];

const ALL_PERMISSIONS: TarteelPermission[] = [
  "dashboard:view", "centers:manage", "branches:manage", "seasons:manage", "circles:view", "circles:manage",
  "teachers:manage", "students:view", "students:manage", "sessions:view", "sessions:manage", "reports:view",
  "settings:view", "settings:manage", "notifications:view", "audit:view", "trash:manage", "ai:use", "quran:view", "messages:manage",
];

const managementPermissions: TarteelPermission[] = ALL_PERMISSIONS.filter(
  (permission) => permission !== "audit:view" && permission !== "trash:manage"
);

export const ROLE_PERMISSIONS: Record<TarteelRole, TarteelPermission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  org_admin: managementPermissions,
  center_manager: managementPermissions,
  supervisor: managementPermissions,
  guide: ["circles:view", "students:view", "sessions:view", "reports:view", "quran:view"],
  teacher: ["dashboard:view", "circles:view", "students:view", "students:manage", "sessions:view", "sessions:manage", "reports:view", "notifications:view", "settings:view", "ai:use", "quran:view", "messages:manage"],
  assistant_teacher: ["dashboard:view", "circles:view", "students:view", "sessions:view", "sessions:manage", "notifications:view", "ai:use", "quran:view", "messages:manage"],
  student: ["students:view", "quran:view"],
  guardian: ["students:view", "quran:view"],
  user: ["dashboard:view", "ai:use", "quran:view"],
};

export const ROLE_LABELS: Record<TarteelRole, string> = {
  super_admin: "مدير النظام",
  admin: "مدير النظام",
  org_admin: "مدير الجهة",
  center_manager: "مدير المركز",
  supervisor: "مشرف المركز",
  guide: "الموجه",
  teacher: "معلم",
  assistant_teacher: "معلم مساعد",
  student: "طالب",
  guardian: "ولي أمر",
  user: "مستخدم",
};

export const NAVIGATION_PERMISSION_RULES = {
  "/dashboard": "dashboard:view",
  "/centers": "centers:manage",
  "/branches": "branches:manage",
  "/seasons": "seasons:manage",
  "/circles": "circles:view",
  "/teachers": "teachers:manage",
  "/teacher-invites": "teachers:manage",
  "/guide": "circles:view",
  "/access-management": "settings:manage",
  "/students": "students:view",
  "/periods": "sessions:view",
  "/reports": "reports:view",
  "/assistant": "ai:use",
  "/quran": "quran:view",
  "/parent-messages": "messages:manage",
  "/notifications": "notifications:view",
  "/settings": "settings:view",
  "/trash": "trash:manage",
  "/audit-log": "audit:view",
} as const satisfies Record<string, TarteelPermission>;

export function normalizeTarteelRole(role: string | null | undefined): TarteelRole {
  return role && role in ROLE_PERMISSIONS ? (role as TarteelRole) : "user";
}

export function hasTarteelPermission(role: string | null | undefined, permission: TarteelPermission): boolean {
  return ROLE_PERMISSIONS[normalizeTarteelRole(role)].includes(permission);
}

export function getVisibleNavigationPaths(role: string | null | undefined): string[] {
  return Object.entries(NAVIGATION_PERMISSION_RULES)
    .filter(([, permission]) => hasTarteelPermission(role, permission))
    .map(([path]) => path);
}
