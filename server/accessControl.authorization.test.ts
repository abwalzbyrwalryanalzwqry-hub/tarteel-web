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

function activeGuideMembership(centerId = 1) {
  return { id: 1, userId: guide.id, centerId, role: "guide" as const, status: "active" as const, isOwner: false, grantedBy: 1, grantedAt: new Date(), expiresAt: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() };
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
});
