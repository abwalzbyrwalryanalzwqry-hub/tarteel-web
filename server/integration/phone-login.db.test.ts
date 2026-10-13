/**
 * تكامل مع MySQL: التسجيل والدخول برقم الهاتف وكلمة المرور، وتوحيد صيغة الرقم، وعدم تكراره.
 */
import { describeWithDb } from "../testing/database";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";
import { localCredentials, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";

const original = { ...ENV };
let ip = 0;
let cookies: string[] = [];
const ctx = (user: TrpcContext["user"] = null): TrpcContext => ({
  user,
  req: {
    protocol: "https",
    ip: `192.0.2.${(ip += 1) % 250}`,
    headers: { "user-agent": "vitest" },
  } as unknown as TrpcContext["req"],
  res: {
    cookie: (name: string) => cookies.push(name),
    clearCookie: () => undefined,
  } as unknown as TrpcContext["res"],
});
const db = async () => (await getDb())!;
/** رقم يمني عشوائي (9 أرقام تبدأ بـ 7) حتى لا تتصادم الاختبارات. */
const randomLocal = () =>
  `7${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;

beforeEach(() => {
  cookies = [];
  Object.assign(ENV, {
    allowSignup: true,
    cookieSecret: "x".repeat(40),
    phoneDefaultCountryCode: "967",
  });
});
afterEach(() => Object.assign(ENV, original));

describeWithDb("التسجيل والدخول برقم الهاتف (MySQL)", () => {
  it("ينشئ حساباً برقم محلي ويحفظه بصيغة دولية، ثم يدخل بأي صيغة للرقم", async () => {
    const local = randomLocal();
    const result = await appRouter.createCaller(ctx()).auth.register({
      name: "صاحب الهاتف",
      phone: `0${local.slice(0, 2)} ${local.slice(2)}`,
      password: "Quran1234",
    });
    expect(result.success).toBe(true);
    expect(cookies.length).toBeGreaterThan(0);

    const [credential] = await (
      await db()
    )
      .select()
      .from(localCredentials)
      .where(eq(localCredentials.phone, `+967${local}`));
    expect(credential).toBeDefined();
    expect(credential.email).toBeNull();
    const [user] = await (
      await db()
    )
      .select()
      .from(users)
      .where(eq(users.id, credential.userId));
    expect(user.phone).toBe(`+967${local}`);
    expect(user.email).toBeNull();

    for (const written of [
      local,
      `+967${local}`,
      `00967${local}`,
      toArabicDigits(local),
    ]) {
      cookies = [];
      await expect(
        appRouter
          .createCaller(ctx())
          .auth.login({ identifier: written, password: "Quran1234" })
      ).resolves.toEqual({ success: true });
      expect(cookies.length).toBeGreaterThan(0);
    }
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ phone: local, password: "Quran1234" })
    ).resolves.toEqual({ success: true });
  });

  it("كلمة المرور الخاطئة والرقم غير المسجل يُرفضان برسالة الهاتف نفسها", async () => {
    const local = randomLocal();
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "مستخدم", phone: local, password: "Quran1234" });
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ identifier: local, password: "Wrong9999" })
    ).rejects.toThrow("رقم الهاتف أو كلمة المرور غير صحيحة");
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ identifier: randomLocal(), password: "Quran1234" })
    ).rejects.toThrow("رقم الهاتف أو كلمة المرور غير صحيحة");
  });

  it("لا يسمح بتسجيل الرقم نفسه مرتين ولو بصيغة مختلفة، ويرفض الرقم غير الصالح", async () => {
    const local = randomLocal();
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "الأول", phone: local, password: "Quran1234" });
    await expect(
      appRouter.createCaller(ctx()).auth.register({
        name: "الثاني",
        phone: `+967 ${local}`,
        password: "Quran1234",
      })
    ).rejects.toThrow("رقم الهاتف هذا");
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.register({ name: "خطأ", phone: "12345", password: "Quran1234" })
    ).rejects.toThrow();
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.register({ name: "بلا معرّف", password: "Quran1234" })
    ).rejects.toThrow("البريد الإلكتروني أو رقم الهاتف");
  });

  it("التسجيل برقم الهاتف يخضع لإغلاق التسجيل العام كالبريد", async () => {
    Object.assign(ENV, { allowSignup: false });
    await expect(
      appRouter.createCaller(ctx()).auth.register({
        name: "زائر",
        phone: randomLocal(),
        password: "Quran1234",
      })
    ).rejects.toThrow("مغلق");
  });

  it("حساب البريد يضيف رقم هاتف من الإعدادات ثم يدخل بأيهما", async () => {
    const email = `phone_add_${randomLocal()}@t.test`;
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "صاحب بريد", email, password: "Quran1234" });
    const [credential] = await (
      await db()
    )
      .select()
      .from(localCredentials)
      .where(eq(localCredentials.email, email));
    const [user] = await (
      await db()
    )
      .select()
      .from(users)
      .where(eq(users.id, credential.userId));
    const local = randomLocal();
    const saved = await appRouter.createCaller(ctx(user)).auth.setPassword({
      identifier: local,
      currentPassword: "Quran1234",
      newPassword: "Mushaf5678",
    });
    expect(saved).toMatchObject({ email, phone: `+967${local}` });
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ identifier: email, password: "Mushaf5678" })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ identifier: local, password: "Mushaf5678" })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter.createCaller(ctx(user)).auth.myCredential()
    ).resolves.toMatchObject({
      hasPassword: true,
      email,
      phone: `+967${local}`,
    });
  });

  it("يضيف رقم هاتف لحساب بريد بكلمة المرور الحالية فقط، ولا يقبل رقماً مأخوذاً", async () => {
    const email = `set_phone_${randomLocal()}@t.test`;
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "بريد", email, password: "Quran1234" });
    const [credential] = await (
      await db()
    )
      .select()
      .from(localCredentials)
      .where(eq(localCredentials.email, email));
    const [user] = await (
      await db()
    )
      .select()
      .from(users)
      .where(eq(users.id, credential.userId));
    const local = randomLocal();
    await expect(
      appRouter
        .createCaller(ctx(user))
        .auth.setLoginPhone({ phone: local, currentPassword: "Wrong9999" })
    ).rejects.toThrow("كلمة المرور الحالية غير صحيحة");
    await expect(
      appRouter
        .createCaller(ctx(user))
        .auth.setLoginPhone({ phone: local, currentPassword: "Quran1234" })
    ).resolves.toEqual({ success: true, phone: `+967${local}` });
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ identifier: local, password: "Quran1234" })
    ).resolves.toEqual({ success: true });

    const taken = randomLocal();
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "آخر", phone: taken, password: "Quran1234" });
    await expect(
      appRouter
        .createCaller(ctx(user))
        .auth.setLoginPhone({ phone: taken, currentPassword: "Quran1234" })
    ).rejects.toThrow("مستخدم في حساب آخر");
  });

  it("الدخول بالبريد يبقى كما هو ويقبل حقل email القديم", async () => {
    const email = `legacy_${randomLocal()}@t.test`;
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "قديم", email, password: "Quran1234" });
    await expect(
      appRouter.createCaller(ctx()).auth.login({ email, password: "Quran1234" })
    ).resolves.toEqual({ success: true });
    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ identifier: email.toUpperCase(), password: "Wrong9999" })
    ).rejects.toThrow("البريد أو كلمة المرور غير صحيحة");
  });
});

function toArabicDigits(value: string) {
  return value.replace(/\d/g, d => String.fromCharCode(0x0660 + Number(d)));
}
