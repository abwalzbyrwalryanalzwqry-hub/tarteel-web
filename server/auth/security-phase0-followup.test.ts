/**
 * تكملة المرحلة 0 الأمنية:
 *  H3 لا يُمنح دور إداري عند التسجيل لأي بريد (ولا لبريد OWNER_EMAIL)
 *  H5 التسجيل مغلق افتراضياً إن لم يُضبط ALLOW_SIGNUP
 *  كوكي الجلسة لا يثق بـ X-Forwarded-Proto إلا من وكيل موثوق
 *  صورة Docker على إصدار Node مدعوم ومطابق لـ CI
 */
import express from "express";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createdUser = {
  id: 77, openId: "local_new", name: "منتحل", email: "owner@tarteel.app", role: "user",
  isActive: true, accountStatus: "active", accessRevokedAt: null, deletedAt: null, sessionVersion: 0,
};

vi.mock("../db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../db")>();
  const emptyQuery = { from: () => ({ where: () => ({ limit: async () => [] }) }) };
  const fakeDb = { select: () => emptyQuery, insert: () => ({ values: async () => undefined }) };
  return {
    ...original,
    getDb: vi.fn(async () => fakeDb),
    upsertUser: vi.fn(async () => undefined),
    getUserByOpenId: vi.fn(async () => createdUser),
    createAuditLog: vi.fn(async () => undefined),
  };
});

import * as db from "../db";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { createLocalUser } from "./localAuth";
import { resetRateLimitsForTests } from "./password";

const original = { ...ENV };
const ctx = (): TrpcContext => ({
  user: null,
  req: { protocol: "https", ip: "203.0.113.5", headers: {} } as unknown as TrpcContext["req"],
  res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
});

describe("H3: لا تصعيد صلاحيات بالبريد عند التسجيل", () => {
  beforeEach(() => {
    Object.assign(ENV, { allowSignup: true, cookieSecret: "test-secret-that-is-long-enough-for-hs256-signing" });
    process.env.OWNER_EMAIL = "owner@tarteel.app";
    vi.mocked(db.upsertUser).mockClear();
  });
  afterEach(() => {
    Object.assign(ENV, original);
    delete process.env.OWNER_EMAIL;
    resetRateLimitsForTests();
  });

  it("التسجيل ببريد المالك (والتسجيل مفتوح) ينشئ حساباً عادياً بلا دور إداري", async () => {
    await expect(
      appRouter.createCaller(ctx()).auth.register({ name: "منتحل", email: "Owner@Tarteel.app", password: "Quran1234" }),
    ).resolves.toEqual({ success: true });
    expect(db.upsertUser).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(db.upsertUser).mock.calls[0][0];
    expect(saved.email).toBe("owner@tarteel.app");
    expect(saved).not.toHaveProperty("role");
  });

  it("الدور الإداري يُمنح فقط حين يُطلب صراحة (مسار سكربت auth:create-admin)", async () => {
    await createLocalUser({ name: "المدير", email: "admin@tarteel.app", password: "Quran1234", role: "super_admin" });
    expect(vi.mocked(db.upsertUser).mock.calls[0][0]).toMatchObject({ role: "super_admin" });
  });
});

describe("H5: التسجيل مغلق افتراضياً", () => {
  const saved = process.env.ALLOW_SIGNUP;
  afterEach(() => {
    if (saved === undefined) delete process.env.ALLOW_SIGNUP; else process.env.ALLOW_SIGNUP = saved;
    vi.resetModules();
  });

  const loadEnv = async (value: string | undefined) => {
    if (value === undefined) delete process.env.ALLOW_SIGNUP; else process.env.ALLOW_SIGNUP = value;
    vi.resetModules();
    return (await import("../_core/env")).ENV;
  };

  it("بلا ALLOW_SIGNUP أو بقيمة فارغة: مغلق", async () => {
    expect((await loadEnv(undefined)).allowSignup).toBe(false);
    expect((await loadEnv("")).allowSignup).toBe(false);
  });

  it("يُفتح فقط بقيمة صريحة", async () => {
    expect((await loadEnv("true")).allowSignup).toBe(true);
    expect((await loadEnv("false")).allowSignup).toBe(false);
  });

  it(".env.example يأتي بالتسجيل مغلقاً", () => {
    const example = readFileSync(path.resolve(import.meta.dirname, "../../.env.example"), "utf8");
    expect(example).toMatch(/^ALLOW_SIGNUP=false$/m);
  });
});

describe("كوكي الجلسة و X-Forwarded-Proto", () => {
  /** يشغّل خادم Express حقيقياً ويعيد قيمة secure كما يحسبها getSessionCookieOptions. */
  async function secureFlag(trustProxy: number | false, headers: Record<string, string>) {
    const app = express();
    app.set("trust proxy", trustProxy);
    app.get("/", (req, res) => res.json(getSessionCookieOptions(req)));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/`, { headers });
      return (await response.json()).secure as boolean;
    } finally {
      server.close();
    }
  }

  it("خادم بلا وكيل موثوق يتجاهل الترويسة المزوّرة", async () => {
    expect(await secureFlag(false, { "x-forwarded-proto": "https" })).toBe(false);
  });

  it("خلف وكيل موثوق (Caddy) يأخذ بها", async () => {
    expect(await secureFlag(1, { "x-forwarded-proto": "https" })).toBe(true);
    expect(await secureFlag(1, {})).toBe(false);
  });
});

describe("صورة Docker", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const dockerNodeMajors = [...readFileSync(path.join(root, "Dockerfile"), "utf8").matchAll(/^FROM node:(\d+)/gm)].map((m) => Number(m[1]));
  const ciNodeMajor = Number(readFileSync(path.join(root, ".github/workflows/web-ci.yml"), "utf8").match(/node-version:\s*(\d+)/)?.[1]);

  it("كل المراحل على Node مدعوم (22 فأعلى)، ومطابق لإصدار CI", () => {
    expect(dockerNodeMajors.length).toBeGreaterThanOrEqual(2);
    for (const major of dockerNodeMajors) {
      expect(major).toBeGreaterThanOrEqual(22);
      expect(major).toBe(ciNodeMajor);
    }
  });
});
