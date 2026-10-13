/** تجديد الجلسة: الكوكي يتجدد بكوكي جديد، وعملاء Bearer يستلمون الرمز الجديد في ترويسة X-Session-Token. */
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  getUserByOpenId: vi.fn(),
  touchLastSignedIn: vi.fn(async () => true),
}));

import * as db from "../db";
import { COOKIE_NAME, SESSION_RENEWAL_HEADER, SESSION_RENEW_AFTER_MS } from "../../shared/const";
import { createContext } from "../_core/context";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";

const SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
const user = { id: 9, openId: "local_abc", name: "معلم", email: "t@tarteel.test", role: "teacher", isActive: true, accountStatus: "active", accessRevokedAt: null, deletedAt: null, sessionVersion: 3, lastSignedIn: new Date() } as any;
const original = { ...ENV };

/** رمز صدر قبل `ageMs` (لمحاكاة جلسة تجاوزت نصف مدتها). */
async function tokenIssuedAgo(ageMs: number) {
  const iat = Math.floor((Date.now() - ageMs) / 1000);
  return new SignJWT({ openId: user.openId, appId: ENV.appId, name: user.name, sv: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 30 * 24 * 3600)
    .sign(new TextEncoder().encode(SECRET));
}

function fakeHttp(headers: Record<string, string>) {
  const response = { headers: {} as Record<string, string>, cookies: [] as string[] };
  const req = { protocol: "https", headers } as any;
  const res = {
    setHeader: (name: string, value: string) => { response.headers[name] = value; },
    cookie: (name: string) => { response.cookies.push(name); },
  } as any;
  return { req, res, response };
}

describe("تجديد الجلسة", () => {
  beforeEach(() => {
    Object.assign(ENV, { cookieSecret: SECRET });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ ...user });
  });
  afterEach(() => Object.assign(ENV, original));

  it("Bearer بعد نصف المدة: رمز جديد في الترويسة، صالح وبنفس إصدار الجلسة", async () => {
    const http = fakeHttp({ authorization: `Bearer ${await tokenIssuedAgo(SESSION_RENEW_AFTER_MS + 60_000)}` });
    const ctx = await createContext({ req: http.req, res: http.res } as any);
    expect(ctx.user?.id).toBe(9);
    const renewed = http.response.headers[SESSION_RENEWAL_HEADER];
    expect(renewed).toBeTruthy();
    expect(http.response.cookies).toEqual([]);
    const session = await sdk.verifySession(renewed);
    expect(session?.sv).toBe(3);
    expect(Date.now() - session!.issuedAtMs).toBeLessThan(5_000);
  });

  it("Bearer حديث: لا تجديد", async () => {
    const http = fakeHttp({ authorization: `Bearer ${await tokenIssuedAgo(60_000)}` });
    await createContext({ req: http.req, res: http.res } as any);
    expect(http.response.headers[SESSION_RENEWAL_HEADER]).toBeUndefined();
  });

  it("الكوكي بعد نصف المدة: كوكي جديد ولا ترويسة", async () => {
    const http = fakeHttp({ cookie: `${COOKIE_NAME}=${await tokenIssuedAgo(SESSION_RENEW_AFTER_MS + 60_000)}` });
    await createContext({ req: http.req, res: http.res } as any);
    expect(http.response.cookies).toEqual([COOKIE_NAME]);
    expect(http.response.headers[SESSION_RENEWAL_HEADER]).toBeUndefined();
  });

  it("الجلسة الملغاة لا تتجدد", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ ...user, sessionVersion: 4 });
    const http = fakeHttp({ authorization: `Bearer ${await tokenIssuedAgo(SESSION_RENEW_AFTER_MS + 60_000)}` });
    const ctx = await createContext({ req: http.req, res: http.res } as any);
    expect(ctx.user).toBeNull();
    expect(http.response.headers[SESSION_RENEWAL_HEADER]).toBeUndefined();
  });
});
