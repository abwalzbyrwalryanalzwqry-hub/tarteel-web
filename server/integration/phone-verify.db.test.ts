/**
 * تكامل مع MySQL: التحقق من رقم الهاتف برمز SMS (Twilio Verify مُحاكى) عند التسجيل والإضافة،
 * واستعادة كلمة المرور بالهاتف للأرقام المؤكدة فقط.
 */
import { describeWithDb } from "../testing/database";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { localCredentials, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";

const original = { ...ENV };
const ipBase = randomInt(0, 200);
let ip = 0;
let cookies: string[] = [];
const ctx = (user: TrpcContext["user"] = null): TrpcContext => ({
  user,
  req: {
    protocol: "https",
    ip: `198.51.${ipBase}.${(ip += 1) % 250}`,
    headers: { "user-agent": "vitest" },
  } as unknown as TrpcContext["req"],
  res: {
    cookie: (name: string) => cookies.push(name),
    clearCookie: () => undefined,
  } as unknown as TrpcContext["res"],
});
const db = async () => (await getDb())!;
const randomPhone = () =>
  `+9677${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
const CODE = "482915";

/** محاكاة Twilio Verify: الرمز صالح للرقم الذي أُرسل إليه فقط، ويُحذف بعد قبوله. */
let pending: Set<string>;
let sent: string[];
const fakeTwilio = vi.fn(async (url: string, init: RequestInit) => {
  const form = new URLSearchParams(String(init.body));
  const to = form.get("To")!;
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status });
  if (url.endsWith("/Verifications")) {
    pending.add(to);
    sent.push(to);
    return reply(201, { status: "pending" });
  }
  if (!pending.has(to)) return reply(404, { code: 20404 });
  if (form.get("Code") !== CODE) return reply(200, { status: "pending" });
  pending.delete(to);
  return reply(200, { status: "approved" });
});

beforeEach(() => {
  cookies = [];
  pending = new Set();
  sent = [];
  Object.assign(ENV, {
    allowSignup: true,
    cookieSecret: "x".repeat(40),
    phoneDefaultCountryCode: "967",
  });
  vi.stubEnv("TWILIO_ACCOUNT_SID", `AC${"1".repeat(32)}`);
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", `VA${"2".repeat(32)}`);
  vi.stubGlobal("fetch", fakeTwilio);
});
afterEach(() => {
  Object.assign(ENV, original);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const credentialOf = async (phone: string) =>
  (
    await (
      await db()
    )
      .select()
      .from(localCredentials)
      .where(eq(localCredentials.phone, phone))
  )[0];
const userOf = async (userId: number) =>
  (await (await db()).select().from(users).where(eq(users.id, userId)))[0];

async function registerVerified(phone: string, password = "Quran1234") {
  await appRouter.createCaller(ctx()).auth.requestSignupPhoneCode({ phone });
  await appRouter
    .createCaller(ctx())
    .auth.register({ name: "مستخدم مؤكد", phone, password, phoneCode: CODE });
  return credentialOf(phone);
}

describeWithDb(
  "التحقق من رقم الهاتف برسالة SMS (MySQL + Twilio مُحاكى)",
  () => {
    it("يعلن تفعيل التحقق في providers", async () => {
      expect(
        (await appRouter.createCaller(ctx()).auth.providers()).phoneVerification
      ).toBe(true);
    });

    it("التسجيل برقم الهاتف يتطلب رمزاً صحيحاً ويحفظ الرقم مؤكداً", async () => {
      const phone = randomPhone();
      const caller = appRouter.createCaller(ctx());
      await expect(
        caller.auth.register({ name: "بلا رمز", phone, password: "Quran1234" })
      ).rejects.toThrow(/رمز التحقق/);
      expect(
        (
          await caller.auth.requestSignupPhoneCode({
            phone: `0${phone.slice(4)}`,
          })
        ).phone
      ).toBe(phone);
      expect(sent).toEqual([phone]);
      await expect(
        caller.auth.register({
          name: "رمز خاطئ",
          phone,
          password: "Quran1234",
          phoneCode: "000000",
        })
      ).rejects.toThrow(/غير صحيح أو منتهٍ/);
      expect(await credentialOf(phone)).toBeUndefined();
      await caller.auth.register({
        name: "رمز صحيح",
        phone,
        password: "Quran1234",
        phoneCode: CODE,
      });
      expect((await credentialOf(phone))?.phoneVerifiedAt).toBeInstanceOf(Date);
    });

    it("لا يرسل رمز تسجيل لرقم مسجّل، ولا حين يكون التسجيل مغلقاً بلا دعوة", async () => {
      const phone = randomPhone();
      await registerVerified(phone);
      sent = [];
      await expect(
        appRouter.createCaller(ctx()).auth.requestSignupPhoneCode({ phone })
      ).rejects.toThrow(/يوجد حساب/);
      ENV.allowSignup = false;
      await expect(
        appRouter
          .createCaller(ctx())
          .auth.requestSignupPhoneCode({ phone: randomPhone() })
      ).rejects.toThrow(/مغلق/);
      expect(sent).toEqual([]);
    });

    it("يحد إرسال الرموز إلى الرقم نفسه (3 في الساعة)", async () => {
      const phone = randomPhone();
      for (let i = 0; i < 3; i += 1)
        await appRouter
          .createCaller(ctx())
          .auth.requestSignupPhoneCode({ phone });
      await expect(
        appRouter.createCaller(ctx()).auth.requestSignupPhoneCode({ phone })
      ).rejects.toThrow(/10 دقائق/);
      expect(sent).toHaveLength(3);
    });

    it("يستعيد كلمة المرور برمز إلى رقم مؤكد، ويدخل بالكلمة الجديدة", async () => {
      const phone = randomPhone();
      const credential = await registerVerified(phone);
      await (
        await db()
      )
        .update(localCredentials)
        .set({ failedAttempts: 5 })
        .where(eq(localCredentials.id, credential.id));
      sent = [];
      expect(
        await appRouter
          .createCaller(ctx())
          .auth.requestPhonePasswordReset({ phone })
      ).toEqual({ success: true, phone });
      expect(sent).toEqual([phone]);
      await expect(
        appRouter.createCaller(ctx()).auth.resetPasswordWithPhone({
          phone,
          code: "111111",
          newPassword: "Tarteel9876",
        })
      ).rejects.toThrow(/غير صحيح/);
      cookies = [];
      await appRouter.createCaller(ctx()).auth.resetPasswordWithPhone({
        phone,
        code: CODE,
        newPassword: "Tarteel9876",
      });
      expect(cookies.length).toBeGreaterThan(0);
      expect((await credentialOf(phone))?.failedAttempts).toBe(0);
      await expect(
        appRouter
          .createCaller(ctx())
          .auth.login({ identifier: phone, password: "Quran1234" })
      ).rejects.toThrow();
      await appRouter
        .createCaller(ctx())
        .auth.login({ identifier: phone, password: "Tarteel9876" });
      // الرمز يُستخدم مرة واحدة.
      await expect(
        appRouter.createCaller(ctx()).auth.resetPasswordWithPhone({
          phone,
          code: CODE,
          newPassword: "Another1234",
        })
      ).rejects.toThrow(/غير صحيح/);
    });

    it("لا يرسل رمز استعادة لرقم غير مؤكد أو غير مسجّل، والرد نفسه دائماً", async () => {
      vi.unstubAllEnvs();
      const phone = randomPhone();
      await appRouter
        .createCaller(ctx())
        .auth.register({ name: "قبل تفعيل SMS", phone, password: "Quran1234" });
      expect((await credentialOf(phone))?.phoneVerifiedAt).toBeNull();
      vi.stubEnv("TWILIO_ACCOUNT_SID", `AC${"1".repeat(32)}`);
      vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
      vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", `VA${"2".repeat(32)}`);
      const unknown = randomPhone();
      expect(
        await appRouter
          .createCaller(ctx())
          .auth.requestPhonePasswordReset({ phone })
      ).toEqual({ success: true, phone });
      expect(
        await appRouter
          .createCaller(ctx())
          .auth.requestPhonePasswordReset({ phone: unknown })
      ).toEqual({ success: true, phone: unknown });
      expect(sent).toEqual([]);
      pending.add(phone);
      await expect(
        appRouter.createCaller(ctx()).auth.resetPasswordWithPhone({
          phone,
          code: CODE,
          newPassword: "Tarteel9876",
        })
      ).rejects.toThrow(/غير صحيح/);
    });

    it("يؤكد رقم الدخول الحالي من الإعدادات", async () => {
      vi.unstubAllEnvs();
      const phone = randomPhone();
      await appRouter
        .createCaller(ctx())
        .auth.register({ name: "يؤكد لاحقاً", phone, password: "Quran1234" });
      vi.stubEnv("TWILIO_ACCOUNT_SID", `AC${"1".repeat(32)}`);
      vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
      vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", `VA${"2".repeat(32)}`);
      const user = await userOf((await credentialOf(phone)).userId);
      const caller = appRouter.createCaller(ctx(user));
      expect(await caller.auth.myCredential()).toMatchObject({
        phone,
        phoneVerified: false,
        smsEnabled: true,
      });
      expect(await caller.auth.sendPhoneVerification()).toEqual({
        success: true,
        alreadyVerified: false,
      });
      await expect(caller.auth.verifyPhone({ code: "999999" })).rejects.toThrow(
        /غير صحيح/
      );
      await caller.auth.verifyPhone({ code: CODE });
      expect((await caller.auth.myCredential()).phoneVerified).toBe(true);
    });

    it("إضافة رقم للدخول تتطلب كلمة المرور ثم رمزاً إلى الرقم الجديد", async () => {
      const first = randomPhone();
      await registerVerified(first);
      const user = await userOf((await credentialOf(first)).userId);
      const caller = appRouter.createCaller(ctx(user));
      const next = randomPhone();
      await expect(
        caller.auth.requestLoginPhoneCode({
          phone: next,
          currentPassword: "Wrong1234",
        })
      ).rejects.toThrow(/الحالية غير صحيحة/);
      sent = [];
      await caller.auth.requestLoginPhoneCode({
        phone: next,
        currentPassword: "Quran1234",
      });
      expect(sent).toEqual([next]);
      await expect(
        caller.auth.setLoginPhone({ phone: next, currentPassword: "Quran1234" })
      ).rejects.toThrow(/رمز التحقق/);
      await caller.auth.setLoginPhone({
        phone: next,
        currentPassword: "Quran1234",
        code: CODE,
      });
      expect((await credentialOf(next))?.phoneVerifiedAt).toBeInstanceOf(Date);
      expect(await credentialOf(first)).toBeUndefined();
    });
  }
);
