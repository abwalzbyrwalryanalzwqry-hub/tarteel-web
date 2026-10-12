import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { ENV } from "../_core/env";
import { getSessionCookieOptions } from "../_core/cookies";
import { resolveLocalPath, getStorageDriver } from "../storage";
import { consumeRateLimit, getPasswordPolicyError, hashPassword, hashSetupToken, normalizeEmail, resetRateLimitsForTests, verifyPassword } from "./password";

function publicCtx(overrides: Partial<TrpcContext["req"]> = {}): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, ...overrides } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("كلمات المرور (scrypt)", () => {
  it("تتحقق من الصحيحة وترفض الخاطئة، وكل تجزئة بملح مختلف", async () => {
    const a = await hashPassword("Tarteel2026");
    const b = await hashPassword("Tarteel2026");
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("Tarteel2026", a)).toBe(true);
    expect(await verifyPassword("tarteel2026", a)).toBe(false);
    expect(await verifyPassword("Tarteel2026", "bcrypt$garbage")).toBe(false);
  });

  it("تطبق سياسة الطول والحروف والأرقام، وتقبل الحروف العربية", () => {
    expect(getPasswordPolicyError("short1")).toContain("8");
    expect(getPasswordPolicyError("onlyletters")).toContain("أرقام");
    expect(getPasswordPolicyError("12345678")).toContain("أرقام");
    expect(getPasswordPolicyError("ترتيل2026ق")).toBeNull();
    expect(getPasswordPolicyError("Quran1234")).toBeNull();
  });

  it("توحّد البريد وتجزئ رموز الإعداد بثبات", () => {
    expect(normalizeEmail("  Ali@Example.COM ")).toBe("ali@example.com");
    expect(hashSetupToken("abc")).toBe(hashSetupToken(" abc "));
    expect(hashSetupToken("abc")).toHaveLength(64);
  });
});

describe("حد المحاولات", () => {
  afterEach(() => resetRateLimitsForTests());
  it("يسمح بـ 20 محاولة في النافذة ثم يمنع، ويعيد الفتح بعد انتهائها", () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i++) expect(consumeRateLimit("ip", now)).toBe(true);
    expect(consumeRateLimit("ip", now)).toBe(false);
    expect(consumeRateLimit("other-ip", now)).toBe(true);
    expect(consumeRateLimit("ip", now + 16 * 60 * 1000)).toBe(true);
  });
});

describe("auth.providers", () => {
  const original = { ...ENV };
  afterEach(() => Object.assign(ENV, original));

  it("الوضع الافتراضي محلي بلا Manus", async () => {
    Object.assign(ENV, { authProvider: "local", oAuthServerUrl: "", allowSignup: true });
    expect(await appRouter.createCaller(publicCtx()).auth.providers()).toEqual({ local: true, manus: false, allowSignup: true });
  });

  it("الوضع الهجين يظهر زر Manus فقط إن كان OAUTH_SERVER_URL مضبوطاً", async () => {
    Object.assign(ENV, { authProvider: "hybrid", oAuthServerUrl: "https://api.manus.im", allowSignup: false });
    expect(await appRouter.createCaller(publicCtx()).auth.providers()).toEqual({ local: true, manus: true, allowSignup: false });
    Object.assign(ENV, { oAuthServerUrl: "" });
    expect((await appRouter.createCaller(publicCtx()).auth.providers()).manus).toBe(false);
  });

  it("وضع manus يرفض الدخول المحلي", async () => {
    Object.assign(ENV, { authProvider: "manus", oAuthServerUrl: "https://api.manus.im" });
    await expect(appRouter.createCaller(publicCtx()).auth.login({ email: "a@b.co", password: "Quran1234" })).rejects.toThrow("غير مفعّل");
  });

  it("إغلاق التسجيل يرفض الحسابات الجديدة لغير المالك", async () => {
    Object.assign(ENV, { authProvider: "local", allowSignup: false, ownerEmail: "owner@tarteel.app" });
    await expect(appRouter.createCaller(publicCtx()).auth.register({ name: "زائر", email: "x@y.co", password: "Quran1234" })).rejects.toThrow("مغلق");
  });

  it("المستخدم العادي لا ينشئ روابط كلمة المرور", async () => {
    const ctx = publicCtx();
    ctx.user = { id: 5, role: "teacher" } as TrpcContext["user"];
    await expect(appRouter.createCaller(ctx).auth.createSetupLink({ userId: 1 })).rejects.toThrow("المدير العام");
  });
});

describe("الكوكي والتخزين", () => {
  it("SameSite=None+Secure على HTTPS و Lax على HTTP المحلي", () => {
    expect(getSessionCookieOptions({ protocol: "https", headers: {} } as any)).toMatchObject({ sameSite: "none", secure: true });
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as any)).toMatchObject({ sameSite: "lax", secure: false });
    expect(getSessionCookieOptions({ protocol: "http", headers: { "x-forwarded-proto": "https" } } as any)).toMatchObject({ secure: true });
  });

  it("يمنع الخروج من مجلد التخزين", () => {
    const root = path.resolve(ENV.storageDir);
    expect(resolveLocalPath("001_3d2f75a2.svg")).toBe(path.join(root, "001_3d2f75a2.svg"));
    expect(resolveLocalPath("../../etc/passwd")).toBeNull();
    expect(resolveLocalPath("%2e%2e/%2e%2e/etc/passwd")).toBeNull();
    expect(resolveLocalPath("")).toBeNull();
  });

  it("يختار المحرك تلقائياً: S3 إن ضُبط، ثم Manus، ثم القرص المحلي", () => {
    const original = { ...ENV };
    Object.assign(ENV, { storageDriver: "", s3Bucket: "", forgeApiUrl: "", forgeApiKey: "" });
    expect(getStorageDriver()).toBe("local");
    Object.assign(ENV, { forgeApiUrl: "https://forge", forgeApiKey: "k" });
    expect(getStorageDriver()).toBe("manus");
    Object.assign(ENV, { s3Bucket: "tarteel" });
    expect(getStorageDriver()).toBe("s3");
    Object.assign(ENV, { storageDriver: "local" });
    expect(getStorageDriver()).toBe("local");
    Object.assign(ENV, original);
  });
});
