/**
 * تكامل مع MySQL: استعادة كلمة المرور بالبريد، وتأكيد البريد، وربط حسابات Google.
 */
import { describeWithDb, uniqueSuffix } from "../testing/database";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { localCredentials, oauthAccounts, passwordSetupTokens, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";
import { GoogleLoginFailure, resolveGoogleUser } from "../auth/google";
import { createLocalUser } from "../auth/localAuth";

const originalEnv = { ...ENV };
const originalProcessEnv = { ...process.env };
let ip = 0;
const ctx = (user: TrpcContext["user"] = null): TrpcContext => ({
  user,
  req: { protocol: "https", ip: `203.0.113.${(ip += 1) % 250}`, headers: { "user-agent": "vitest" } } as unknown as TrpcContext["req"],
  res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
});
const db = async () => (await getDb())!;

/** يلتقط الرسائل المرسلة بدل إرسالها فعلاً. */
let sent: { to: string; text: string }[] = [];
beforeEach(() => {
  sent = [];
  Object.assign(ENV, { cookieSecret: "x".repeat(40), publicAppUrl: "https://tarteel.test" });
  Object.assign(process.env, { RESEND_API_KEY: "re_test", EMAIL_FROM: "no-reply@tarteel.test", EMAIL_PROVIDER: "" });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ to: body.to[0], text: body.text });
    return new Response(JSON.stringify({ id: "m" }), { status: 200 });
  }));
});
afterEach(() => {
  Object.assign(ENV, originalEnv);
  process.env = { ...originalProcessEnv };
  vi.unstubAllGlobals();
});

const tokenFrom = (text: string) => decodeURIComponent(/token=([^&\s]+)/.exec(text)![1]);

describeWithDb("استعادة كلمة المرور وتأكيد البريد (MySQL)", () => {
  it("الاستعادة: رسالة برابط 30 دقيقة، تعيين كلمة جديدة، تأكيد البريد، والرابط لا يُستخدم مرتين", async () => {
    const s = uniqueSuffix();
    const user = await createLocalUser({ name: "مستعيد", email: `reset_${s}@t.test`, password: "Quran1234" });
    expect((await appRouter.createCaller(ctx()).auth.providers()).passwordReset).toBe(true);
    await appRouter.createCaller(ctx()).auth.requestPasswordReset({ email: `RESET_${s}@t.test` });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(`reset_${s}@t.test`);
    expect(sent[0].text).toContain("https://tarteel.test/set-password?token=");
    const token = tokenFrom(sent[0].text);
    const [row] = await (await db()).select().from(passwordSetupTokens).where(and(eq(passwordSetupTokens.userId, user.id), eq(passwordSetupTokens.purpose, "reset")));
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000 + 5000);

    await appRouter.createCaller(ctx()).auth.completeSetup({ token, password: "Mushaf5678" });
    await expect(appRouter.createCaller(ctx()).auth.login({ email: `reset_${s}@t.test`, password: "Mushaf5678" })).resolves.toMatchObject({ success: true });
    const [credential] = await (await db()).select().from(localCredentials).where(eq(localCredentials.userId, user.id));
    expect(credential.emailVerifiedAt).not.toBeNull();
    await expect(appRouter.createCaller(ctx()).auth.completeSetup({ token, password: "Other9999" })).rejects.toThrow();
  });

  it("بريد غير مسجّل: الرد نفسه ولا رسالة", async () => {
    await expect(appRouter.createCaller(ctx()).auth.requestPasswordReset({ email: `nobody_${uniqueSuffix()}@t.test` })).resolves.toEqual({ success: true });
    expect(sent).toHaveLength(0);
  });

  it("بلا PUBLIC_APP_URL تُرفض الاستعادة ولا تُبنى روابط من ترويسة Host", async () => {
    Object.assign(ENV, { publicAppUrl: "" });
    expect((await appRouter.createCaller(ctx()).auth.providers()).passwordReset).toBe(false);
    await expect(appRouter.createCaller(ctx()).auth.requestPasswordReset({ email: "a@t.test" })).rejects.toThrow("غير مفعّلة");
  });

  it("رابط الاستعادة الجديد يلغي القديم", async () => {
    const s = uniqueSuffix();
    await createLocalUser({ name: "م", email: `twice_${s}@t.test`, password: "Quran1234" });
    await appRouter.createCaller(ctx()).auth.requestPasswordReset({ email: `twice_${s}@t.test` });
    await appRouter.createCaller(ctx()).auth.requestPasswordReset({ email: `twice_${s}@t.test` });
    const [first, second] = sent.map((m) => tokenFrom(m.text));
    await expect(appRouter.createCaller(ctx()).auth.completeSetup({ token: first, password: "Mushaf5678" })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx()).auth.completeSetup({ token: second, password: "Mushaf5678" })).resolves.toMatchObject({ success: true });
  });

  it("التسجيل يرسل رابط تأكيد يؤكد البريد، ولا يصلح لتعيين كلمة مرور", async () => {
    Object.assign(ENV, { allowSignup: true });
    const s = uniqueSuffix();
    await appRouter.createCaller(ctx()).auth.register({ name: "جديد", email: `verify_${s}@t.test`, password: "Quran1234" });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const token = tokenFrom(sent[0].text);
    expect(sent[0].text).toContain("https://tarteel.test/verify-email?token=");
    await expect(appRouter.createCaller(ctx()).auth.completeSetup({ token, password: "Hijack1234" })).rejects.toThrow("غير صالح");
    await expect(appRouter.createCaller(ctx()).auth.verifyEmail({ token })).resolves.toEqual({ success: true });
    const [credential] = await (await db()).select().from(localCredentials).where(eq(localCredentials.email, `verify_${s}@t.test`));
    expect(credential.emailVerifiedAt).not.toBeNull();
    await expect(appRouter.createCaller(ctx()).auth.verifyEmail({ token })).rejects.toThrow();
  });
});

describeWithDb("ربط حسابات Google (MySQL)", () => {
  it("بريد مؤكد يطابق حساباً موجوداً ← يُربط به، والدخول التالي بالمعرّف الثابت", async () => {
    const s = uniqueSuffix();
    const local = await createLocalUser({ name: "محلي", email: `g_link_${s}@t.test`, password: "Quran1234" });
    const first = await resolveGoogleUser({ sub: `sub-${s}`, email: `g_link_${s}@t.test`, emailVerified: true, name: "Google" }, {});
    expect(first).toMatchObject({ created: false, linked: true });
    expect(first.user.id).toBe(local.id);
    const [credential] = await (await db()).select().from(localCredentials).where(eq(localCredentials.userId, local.id));
    expect(credential.emailVerifiedAt).not.toBeNull();
    // تغيّر بريد Google لاحقاً: يبقى الربط بـ sub.
    const again = await resolveGoogleUser({ sub: `sub-${s}`, email: `changed_${s}@t.test`, emailVerified: false, name: null }, {});
    expect(again).toMatchObject({ created: false, linked: false });
    expect(again.user.id).toBe(local.id);
  });

  it("بريد غير مؤكد لا يُربط أبداً بحساب موجود", async () => {
    const s = uniqueSuffix();
    await createLocalUser({ name: "ضحية", email: `victim_${s}@t.test`, password: "Quran1234" });
    await expect(resolveGoogleUser({ sub: `attacker-${s}`, email: `victim_${s}@t.test`, emailVerified: false, name: null }, {})).rejects.toMatchObject({ code: "unverified_email" });
    expect(await (await db()).select().from(oauthAccounts).where(eq(oauthAccounts.providerUserId, `attacker-${s}`))).toHaveLength(0);
  });

  it("حساب جديد: يُرفض مع إغلاق التسجيل، ويُنشأ مع فتحه", async () => {
    const s = uniqueSuffix();
    Object.assign(ENV, { allowSignup: false });
    await expect(resolveGoogleUser({ sub: `new-${s}`, email: `new_${s}@t.test`, emailVerified: true, name: "جديد" }, {})).rejects.toBeInstanceOf(GoogleLoginFailure);
    Object.assign(ENV, { allowSignup: true });
    const result = await resolveGoogleUser({ sub: `new-${s}`, email: `new_${s}@t.test`, emailVerified: true, name: "جديد" }, {});
    expect(result.created).toBe(true);
    const [user] = await (await db()).select().from(users).where(eq(users.id, result.user.id));
    expect(user).toMatchObject({ loginMethod: "google", email: `new_${s}@t.test`, name: "جديد" });
  });

  it("رمز دعوة غير صالح مع التسجيل المغلق يُرفض دون إنشاء حساب", async () => {
    const s = uniqueSuffix();
    Object.assign(ENV, { allowSignup: false });
    await expect(resolveGoogleUser({ sub: `inv-${s}`, email: `inv_${s}@t.test`, emailVerified: true, name: null }, { inviteCode: "TRTL-00000000" })).rejects.toMatchObject({ code: "invite_invalid" });
    expect(await (await db()).select().from(users).where(eq(users.email, `inv_${s}@t.test`))).toHaveLength(0);
  });
});
