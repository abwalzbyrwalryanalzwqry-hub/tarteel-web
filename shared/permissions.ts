export type TarteelRole =
  | "super_admin"
  | "org_admin"
  | "center_manager"
  | "supervisor"
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
  | "ai:use";

const ALL_PERMISSIONS: TarteelPermission[] = [
  "dashboard:view", "centers:manage", "branches:manage", "seasons:manage", "circles:view", "circles:manage",
  "teachers:manage", "students:view", "students:manage", "sessions:view", "sessions:manage", "reports:view",
  "settings:view", "settings:manage", "notifications:view", "audit:view", "trash:manage", "ai:use",
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
  teacher: ["dashboard:view", "circles:view", "students:view", "sessions:view", "sessions:manage", "reports:view", "notifications:view", "settings:view", "ai:use"],
  assistant_teacher: ["dashboard:view", "circles:view", "students:view", "sessions:view", "sessions:manage", "notifications:view", "ai:use"],
  student: ["dashboard:view", "settings:view", "notifications:view", "ai:use"],
  guardian: ["dashboard:view", "settings:view", "notifications:view", "ai:use"],
  user: ["dashboard:view", "ai:use"],
};

export const ROLE_LABELS: Record<TarteelRole, string> = {
  super_admin: "مدير النظام",
  admin: "مدير النظام",
  org_admin: "مدير الجهة",
  center_manager: "مدير المركز",
  supervisor: "مشرف المركز",
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
  "/students": "students:view",
  "/sessions": "sessions:view",
  "/reports": "reports:view",
  "/assistant": "ai:use",
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
