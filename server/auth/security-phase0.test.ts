/**
 * اختبارات المرحلة 0 الأمنية:
 *  H1 حد المحاولات لا يُتجاوز بتزوير X-Forwarded-For
 *  H2 الجلسات قابلة للإبطال ومدتها محدودة، والحساب الموقوف يُرفض
 *  H5 حد يومي للمساعد الذكي
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getUserByOpenId: vi.fn(),
  touchLastSignedIn: vi.fn(async () => true),
  bumpSessionVersion: vi.fn(async () => 1),
}));

import * as db from "../db";
import { COOKIE_NAME, SESSION_RENEW_AFTER_MS, SESSION_TTL_MS } from "../../shared/const";
import { ENV } from "../_core/env";
import { getClientIp } from "../_core/request";
import { sdk } from "../_core/sdk";
import { consumeAiQuota, resetAiQuotaForTests } from "../routers/ai";
import { clientKey } from "./localAuth";

const SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
const baseUser = {
  id: 9, openId: "local_abc", name: "معلم", email: "t@tarteel.test", role: "teacher",
  isActive: true, accountStatus: "active", accessRevokedAt: null, deletedAt: null,
  sessionVersion: 0, lastSignedIn: new Date(),
} as any;

const reqWithCookie = (token: string) => ({ headers: { cookie: `${COOKIE_NAME}=${token}` } }) as any;

describe("H1: عنوان IP الحقيقي", () => {
  it("مفتاح حد المحاولات يتجاهل X-Forwarded-For المزوّر ويستخدم req.ip", () => {
    const ctx = { req: { ip: "203.0.113.7", headers: { "x-forwarded-for": "1.2.3.4" } } } as any;
    expect(clientKey(ctx)).toBe("203.0.113.7");
  });

  it("خلف وكيل واحد، Express يأخذ العنوان الذي أضافه الوكيل لا الذي كتبه العميل", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.get("/ip", (req, res) => res.send(getClientIp(req)));
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      // العميل كتب 6.6.6.6 والوكيل (Caddy) أضاف العنوان الحقيقي في النهاية.
      const res = await fetch(`http://127.0.0.1:${port}/ip`, { headers: { "x-forwarded-for": "6.6.6.6, 198.51.100.20" } });
      expect(await res.text()).toBe("198.51.100.20");
    } finally {
      server.close();
    }
  });
});

describe("H2: الجلسات", () => {
  const original = { ...ENV };
  beforeEach(() => {
    Object.assign(ENV, { cookieSecret: SECRET, appId: "tarteel" });
    vi.mocked(db.getUserByOpenId).mockReset();
  });
  afterEach(() => Object.assign(ENV, original));

  it("الجلسة الجديدة مدتها 30 يوماً وتحمل رقم الإصدار", async () => {
    const token = await sdk.createSessionToken("local_abc", { sessionVersion: 3 });
    const session = await sdk.verifySession(token);
    expect(session?.sv).toBe(3);
    const exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp * 1000;
    expect(exp - Date.now()).toBeLessThanOrEqual(SESSION_TTL_MS);
    expect(exp - Date.now()).toBeGreaterThan(SESSION_TTL_MS - 60_000);
  });

  it("تقبل الجلسة عندما يطابق الإصدار، وترفضها بعد رفعه (تغيير كلمة المرور أو الخروج من كل الأجهزة)", async () => {
    const token = await sdk.createSessionToken("local_abc", { sessionVersion: 0 });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ ...baseUser, sessionVersion: 0 });
    await expect(sdk.authenticateRequest(reqWithCookie(token))).resolves.toMatchObject({ id: 9 });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ ...baseUser, sessionVersion: 1 });
    await expect(sdk.authenticateRequest(reqWithCookie(token))).rejects.toThrow("revoked");
  });

  it.each([
    ["suspended", { accountStatus: "suspended" }],
    ["disabled", { accountStatus: "disabled" }],
    ["access revoked", { accessRevokedAt: new Date() }],
    ["inactive", { isActive: false }],
    ["deleted", { deletedAt: new Date() }],
  ])("ترفض جلسة الحساب %s فوراً", async (_label, patch) => {
    const token = await sdk.createSessionToken("local_abc", { sessionVersion: 0 });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ ...baseUser, ...patch });
    await expect(sdk.authenticateRequest(reqWithCookie(token))).rejects.toThrow("not active");
  });

  it("ترفض الجلسات القديمة (سنة كاملة، بلا رقم إصدار)", async () => {
    const legacy = await new SignJWT({ openId: "local_abc", appId: "tarteel", name: "x" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor((Date.now() + 365 * 86_400_000) / 1000))
      .sign(new TextEncoder().encode(SECRET));
    expect(await sdk.verifySession(legacy)).toBeNull();
  });

  it("تجدد الكوكي بعد مرور نصف المدة فقط", () => {
    const now = Date.now();
    expect(sdk.shouldRenew({ issuedAtMs: now - 1000 } as any, now)).toBe(false);
    expect(sdk.shouldRenew({ issuedAtMs: now - SESSION_RENEW_AFTER_MS } as any, now)).toBe(true);
  });

  it("لا تكتب آخر دخول في قاعدة البيانات مع كل طلب إلا عبر الدالة المقيّدة", async () => {
    const token = await sdk.createSessionToken("local_abc", { sessionVersion: 0 });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ ...baseUser });
    await sdk.authenticateRequest(reqWithCookie(token));
    expect(db.touchLastSignedIn).toHaveBeenCalled();
  });
});

describe("H5: حد المساعد الذكي", () => {
  afterEach(() => resetAiQuotaForTests());

  it("يسمح بالحد اليومي ثم يمنع، ويعيد الفتح في اليوم التالي، والحد مستقل لكل مستخدم", () => {
    const day1 = new Date("2026-10-13T10:00:00Z");
    for (let i = 0; i < 3; i++) expect(consumeAiQuota(1, 3, day1)).toBe(true);
    expect(consumeAiQuota(1, 3, day1)).toBe(false);
    expect(consumeAiQuota(2, 3, day1)).toBe(true);
    expect(consumeAiQuota(1, 3, new Date("2026-10-14T00:00:01Z"))).toBe(true);
  });

  it("الحد 0 يعطّل المساعد", () => {
    expect(consumeAiQuota(1, 0)).toBe(false);
  });
});
