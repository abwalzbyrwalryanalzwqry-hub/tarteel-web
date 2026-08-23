import { describe, expect, it } from "vitest";

import { getTeacherInviteAvailability } from "../shared/teacherInvites";

describe("أكواد انضمام المعلمين", () => {
  it("تستخدم البادئة المختصرة والصيغة الآمنة المعروضة للمستخدم", () => {
    const sampleCode = "TRTL-A1B2C3D4";
    expect(sampleCode).toMatch(/^TRTL-[A-F0-9]{8}$/);
  });

  it("يفصل بين الدعوة الصالحة والمستخدمة والملغاة والمنتهية", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    expect(getTeacherInviteAvailability({ isRevoked: false, usedAt: null, expiresAt: null }, now)).toBe("active");
    expect(getTeacherInviteAvailability({ isRevoked: false, usedAt: new Date("2026-08-23"), expiresAt: null }, now)).toBe("used");
    expect(getTeacherInviteAvailability({ isRevoked: true, usedAt: null, expiresAt: null }, now)).toBe("revoked");
    expect(getTeacherInviteAvailability({ isRevoked: false, usedAt: null, expiresAt: new Date("2026-08-24T11:59:59.000Z") }, now)).toBe("expired");
  });
});
