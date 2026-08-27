import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  membership: vi.fn(),
  grants: vi.fn(),
  scopes: vi.fn(),
  teacher: vi.fn(),
  circles: vi.fn(),
  parentLinks: vi.fn(),
  student: vi.fn(),
  centerForCircle: vi.fn(),
  centerForStudent: vi.fn(),
}));

vi.mock("./db", () => ({
  getActiveCenterMembership: dbMocks.membership,
  getActivePermissionGrants: dbMocks.grants,
  getActiveUserScopes: dbMocks.scopes,
  getTeacherByUserId: dbMocks.teacher,
  getCircleIdsForTeacher: dbMocks.circles,
  getParentStudentLinks: dbMocks.parentLinks,
  getStudentByUserId: dbMocks.student,
  getCenterIdForCircle: dbMocks.centerForCircle,
  getCenterIdForStudent: dbMocks.centerForStudent,
}));

import { assertCirclePermission, assertPermission, assertScope, assertStudentPermission } from "./accessControl";

type TestRole = "center_manager" | "supervisor" | "guide" | "teacher" | "assistant_teacher" | "student" | "guardian";

const users = {
  manager: { id: 101, role: "admin", isActive: true, accountStatus: "active" as const, accessRevokedAt: null },
  supervisor: { id: 102, role: "supervisor", isActive: true, accountStatus: "active" as const, accessRevokedAt: null },
  guide: { id: 103, role: "guide", isActive: true, accountStatus: "active" as const, accessRevokedAt: null },
  teacher: { id: 104, role: "teacher", isActive: true, accountStatus: "active" as const, accessRevokedAt: null },
  assistant: { id: 105, role: "assistant_teacher", isActive: true, accountStatus: "active" as const, accessRevokedAt: null },
  student: { id: 106, role: "student", isActive: true, accountStatus: "active" as const, accessRevokedAt: null },
  guardian: { id: 107, role: "guardian", isActive: true, accountStatus: "active" as const, accessRevokedAt: null },
};

function membership(userId: number, role: TestRole, options: { owner?: boolean; centerId?: number } = {}) {
  return {
    id: userId,
    userId,
    centerId: options.centerId ?? 1,
    role,
    status: "active" as const,
    isOwner: options.owner ?? false,
    grantedBy: users.manager.id,
    grantedAt: new Date(),
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function scope(userId: number, type: "center" | "circle" | "student", id: number) {
  return { id: `${userId}-${type}-${id}`, userId, centerId: 1, scopeType: type, scopeId: id, grantedBy: users.manager.id, expiresAt: null, revokedAt: null, createdAt: new Date() };
}

describe("اختبار قبول الصلاحيات متعدد الحسابات", () => {
  beforeEach(() => {
    dbMocks.membership.mockResolvedValue(undefined);
    dbMocks.grants.mockResolvedValue([]);
    dbMocks.scopes.mockResolvedValue([]);
    dbMocks.teacher.mockResolvedValue(undefined);
    dbMocks.circles.mockResolvedValue([]);
    dbMocks.parentLinks.mockResolvedValue([]);
    dbMocks.student.mockResolvedValue(undefined);
    dbMocks.centerForCircle.mockResolvedValue(1);
    dbMocks.centerForStudent.mockResolvedValue(1);
  });

  it("يمنح مالك المركز الصلاحيات الكاملة داخل مركزه فقط", async () => {
    dbMocks.membership.mockImplementation(async (userId: number, centerId: number) => userId === users.manager.id && centerId === 1 ? membership(userId, "center_manager", { owner: true }) : undefined);

    await expect(assertPermission(users.manager, 1, "settings.edit")).resolves.toBeDefined();
    await expect(assertScope(users.manager, 1, { circleId: 999, studentId: 999 })).resolves.toBeDefined();
    await expect(assertPermission(users.manager, 2, "settings.edit")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمنح المشرف صلاحيات المركز التعليمية ولا يمنحه إعدادات المركز", async () => {
    dbMocks.membership.mockResolvedValue(membership(users.supervisor.id, "supervisor"));
    dbMocks.scopes.mockResolvedValue([scope(users.supervisor.id, "center", 1)]);

    await expect(assertPermission(users.supervisor, 1, "students.transfer")).resolves.toBeDefined();
    await expect(assertScope(users.supervisor, 1, { circleId: 11, studentId: 201 })).resolves.toBeDefined();
    await expect(assertPermission(users.supervisor, 1, "settings.edit")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يطبق سحب الصلاحية الدقيقة فوراً ولا يحجب صلاحيات القراءة الأخرى للمشرف", async () => {
    dbMocks.membership.mockResolvedValue(membership(users.supervisor.id, "supervisor"));
    dbMocks.scopes.mockResolvedValue([scope(users.supervisor.id, "center", 1)]);
    dbMocks.grants.mockResolvedValue([{ effect: "deny", permission: "reports.export" }]);

    await expect(assertPermission(users.supervisor, 1, "reports.view")).resolves.toBeDefined();
    await expect(assertPermission(users.supervisor, 1, "reports.export")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يحصر الموجه في الحلقات الممنوحة وفي القراءة الإشرافية فقط", async () => {
    dbMocks.membership.mockResolvedValue(membership(users.guide.id, "guide"));
    dbMocks.scopes.mockResolvedValue([scope(users.guide.id, "circle", 11)]);

    await expect(assertCirclePermission(users.guide, 11, "reports.view")).resolves.toBeDefined();
    await expect(assertScope(users.guide, 1, { circleId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertPermission(users.guide, 1, "students.edit")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertPermission(users.guide, 1, "access_codes.create")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يحصر المعلم في حلقة واحدة ويمنحه عمليات طلابها وجلساتها فقط", async () => {
    dbMocks.membership.mockResolvedValue(membership(users.teacher.id, "teacher"));
    dbMocks.scopes.mockResolvedValue([scope(users.teacher.id, "circle", 21)]);
    dbMocks.teacher.mockResolvedValue({ id: 801, userId: users.teacher.id });
    dbMocks.circles.mockResolvedValue([21]);

    await expect(assertCirclePermission(users.teacher, 21, "students.create")).resolves.toBeDefined();
    await expect(assertCirclePermission(users.teacher, 22, "students.create")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertPermission(users.teacher, 1, "students.transfer")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يسمح للمساعد بالحضور في حلقته ولا يمنحه إدارة الطلاب", async () => {
    dbMocks.membership.mockResolvedValue(membership(users.assistant.id, "assistant_teacher"));
    dbMocks.scopes.mockResolvedValue([scope(users.assistant.id, "circle", 31)]);
    dbMocks.teacher.mockResolvedValue({ id: 802, userId: users.assistant.id });
    dbMocks.circles.mockResolvedValue([31]);

    await expect(assertCirclePermission(users.assistant, 31, "attendance.create")).resolves.toBeDefined();
    await expect(assertPermission(users.assistant, 1, "students.create")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertScope(users.assistant, 1, { circleId: 32 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يحصر الطالب في ملفه وإنجازاته ويمنعه من قائمة الحضور أو ملف طالب آخر", async () => {
    dbMocks.membership.mockResolvedValue(membership(users.student.id, "student"));
    dbMocks.scopes.mockResolvedValue([scope(users.student.id, "student", 401)]);
    dbMocks.student.mockResolvedValue({ id: 401, userId: users.student.id });

    await expect(assertStudentPermission(users.student, 401, "reports.view")).resolves.toBeDefined();
    await expect(assertStudentPermission(users.student, 402, "reports.view")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertPermission(users.student, 1, "attendance.view")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يحصر ولي الأمر في الابن المرتبط به ويمنع الطلبة الآخرين", async () => {
    dbMocks.membership.mockResolvedValue(membership(users.guardian.id, "guardian"));
    dbMocks.scopes.mockResolvedValue([scope(users.guardian.id, "student", 501)]);
    dbMocks.parentLinks.mockResolvedValue([{ studentId: 501, centerId: 1 }]);

    await expect(assertStudentPermission(users.guardian, 501, "reports.view")).resolves.toBeDefined();
    await expect(assertStudentPermission(users.guardian, 502, "reports.view")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertPermission(users.guardian, 1, "students.edit")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض الحساب غير النشط قبل أي فحص للدور أو النطاق", async () => {
    const revokedTeacher = { ...users.teacher, isActive: false };
    dbMocks.membership.mockResolvedValue(membership(revokedTeacher.id, "teacher"));

    await expect(assertPermission(revokedTeacher, 1, "students.view")).rejects.toMatchObject({ code: "FORBIDDEN", message: "حسابك غير نشط" });
  });
});
