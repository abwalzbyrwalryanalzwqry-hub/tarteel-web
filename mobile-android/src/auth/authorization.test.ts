import { describe, expect, it } from "vitest";
import { canAccessResource } from "./authorization";
import type { LocalSession } from "./localSession";

const baseSession: LocalSession = {
  userId: "user-1",
  displayName: "مستخدم",
  roles: ["teacher"],
  scopes: [{ scopeType: "circle", scopeId: "circle-1" }],
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:00:00.000Z",
  snapshotVersion: 1,
};

describe("local authorization", () => {
  it("keeps a teacher inside the assigned circle", () => {
    expect(canAccessResource(baseSession, { circleId: "circle-1" }, "update")).toBe(true);
    expect(canAccessResource(baseSession, { circleId: "circle-2" }, "read")).toBe(false);
  });

  it("allows a student to read only a scoped student", () => {
    const studentSession = { ...baseSession, roles: ["student"], scopes: [{ scopeType: "student", scopeId: "student-1" }] };
    expect(canAccessResource(studentSession, { studentId: "student-1" }, "read")).toBe(true);
    expect(canAccessResource(studentSession, { studentId: "student-1" }, "update")).toBe(false);
    expect(canAccessResource(studentSession, { studentId: "student-2" }, "read")).toBe(false);
  });

  it("does not let a center role access another center", () => {
    const managerSession = { ...baseSession, roles: ["center_manager"], scopes: [{ scopeType: "center", scopeId: "center-1" }] };
    expect(canAccessResource(managerSession, { centerId: "center-1" }, "export")).toBe(true);
    expect(canAccessResource(managerSession, { centerId: "center-2" }, "read")).toBe(false);
  });
});
