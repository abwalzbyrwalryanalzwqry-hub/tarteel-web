import { describe, expect, it } from "vitest";
import { hasActiveAccessMembership } from "../shared/accessMembership";

describe("تفعيل الحساب بكود الدخول", () => {
  const now = Date.UTC(2026, 7, 25);

  it("يوجه الحساب بلا عضوية نشطة إلى استرداد كود الدخول", () => {
    expect(hasActiveAccessMembership([] , now)).toBe(false);
    expect(hasActiveAccessMembership([{ status: "revoked", revokedAt: null, expiresAt: null }], now)).toBe(false);
    expect(hasActiveAccessMembership([{ status: "active", revokedAt: new Date(now), expiresAt: null }], now)).toBe(false);
  });

  it("يبقي الحساب ذي العضوية النشطة في لوحة الصلاحيات", () => {
    expect(hasActiveAccessMembership([{ status: "active", revokedAt: null, expiresAt: new Date(now + 60_000) }], now)).toBe(true);
    expect(hasActiveAccessMembership([{ status: "active", revokedAt: null, expiresAt: null }], now)).toBe(true);
    expect(hasActiveAccessMembership([{ status: "active", revokedAt: null, expiresAt: new Date(now - 1) }], now)).toBe(false);
  });
});
