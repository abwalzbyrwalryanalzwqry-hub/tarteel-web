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

import { assertCanDelegate, assertPermission, assertScope } from "./accessControl";

const guide = { id: 41, role: "guide", isActive: true, accountStatus: "active" as const, accessRevokedAt: null };
const studentReader = { id: 51, role: "student", isActive: true, accountStatus: "active" as const, accessRevokedAt: null };
const guardianReader = { id: 61, role: "guardian", isActive: true, accountStatus: "active" as const, accessRevokedAt: null };

function activeGuideMembership(centerId = 1) {
  return { id: 1, userId: guide.id, centerId, role: "guide" as const, status: "active" as const, isOwner: false, grantedBy: 1, grantedAt: new Date(), expiresAt: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() };
}

function activeMembership(userId: number, role: "student" | "guardian", centerId = 1) {
  return { id: userId, userId, centerId, role, status: "active" as const, isOwner: false, grantedBy: 1, grantedAt: new Date(), expiresAt: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() };
}

describe("حراسة الصلاحيات والنطاق", () => {
  beforeEach(() => {
    dbMocks.membership.mockResolvedValue(activeGuideMembership());
    dbMocks.grants.mockResolvedValue([]);
    dbMocks.scopes.mockResolvedValue([{ id: 1, userId: guide.id, centerId: 1, scopeType: "circle", scopeId: 11, grantedBy: 1, expiresAt: null, revokedAt: null, createdAt: new Date() }]);
    dbMocks.teacher.mockResolvedValue(undefined);
    dbMocks.circles.mockResolvedValue([]);
    dbMocks.parentLinks.mockResolvedValue([]);
    dbMocks.student.mockResolvedValue(undefined);
  });

  it("يسمح للموجه بالحَلَقة الممنوحة ويرفض حَلَقة أخرى في المركز نفسه", async () => {
    await expect(assertScope(guide, 1, { circleId: 11 })).resolves.toBeDefined();
    await expect(assertScope(guide, 1, { circleId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض الوصول إلى مركز بلا عضوية حتى لو كان الدور نفسه صالحاً في مركز آخر", async () => {
    dbMocks.membership.mockResolvedValueOnce(undefined);
    await expect(assertPermission(guide, 2, "reports.view")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمنع الموجه من تفويض صلاحية تحرير الطلاب أو نطاق غير مملوك", async () => {
    await expect(assertCanDelegate(guide, 1, ["students.edit"], [11])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertCanDelegate(guide, 1, ["reports.view"], [12])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يقصر الطالب على ملفه ويمنع القراءة خارج نطاق كوده أو قراءة الحضور", async () => {
    dbMocks.membership.mockResolvedValue(activeMembership(studentReader.id, "student"));
    dbMocks.scopes.mockResolvedValue([{ id: 2, userId: studentReader.id, centerId: 1, scopeType: "student", scopeId: 101, grantedBy: 1, expiresAt: null, revokedAt: null, createdAt: new Date() }]);
    dbMocks.student.mockResolvedValue({ id: 101 });
    await expect(assertScope(studentReader, 1, { studentId: 101 })).resolves.toBeDefined();
    await expect(assertScope(studentReader, 1, { studentId: 102 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertPermission(studentReader, 1, "attendance.view")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يقصر ولي الأمر على الابن المربوط ويمنع أي طالب آخر", async () => {
    dbMocks.membership.mockResolvedValue(activeMembership(guardianReader.id, "guardian"));
    dbMocks.scopes.mockResolvedValue([{ id: 3, userId: guardianReader.id, centerId: 1, scopeType: "student", scopeId: 201, grantedBy: 1, expiresAt: null, revokedAt: null, createdAt: new Date() }]);
    dbMocks.parentLinks.mockResolvedValue([{ studentId: 201, centerId: 1 }]);
    await expect(assertScope(guardianReader, 1, { studentId: 201 })).resolves.toBeDefined();
    await expect(assertScope(guardianReader, 1, { studentId: 202 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
