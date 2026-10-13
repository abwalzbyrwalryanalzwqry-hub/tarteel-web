/**
 * تكامل مع MySQL: التحقق العكسي عبر واتساب (Webhook حقيقي على Express بتوقيع Meta)،
 * والاحتياط برمز SMS، وربط ولي الأمر تلقائياً بكل أبنائه المسجلين برقمه.
 */
import { describeWithDb, uniqueSuffix } from "../testing/database";
import express from "express";
import { createHmac, randomInt } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  academicSeasons,
  branches,
  centerMemberships,
  centers,
  circles,
  localCredentials,
  organizations,
  parentStudentLinks,
  students,
  users,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";
import {
  registerWhatsAppWebhook,
  WHATSAPP_WEBHOOK_PATH,
} from "../_core/whatsappWebhook";
import { accessCodes, userScopes } from "../../drizzle/schema";
import { hashAccessCode } from "../accessCodeSecurity";
import { redeemAccessCodeSecure } from "../data/access-control";

const APP_SECRET = "a".repeat(40);
const VERIFY_TOKEN = "tarteel-verify-token";
const original = { ...ENV };
const ipBase = randomInt(0, 200);
let ip = 0;
const ctx = (user: TrpcContext["user"] = null): TrpcContext => ({
  user,
  req: {
    protocol: "https",
    ip: `203.0.${ipBase}.${(ip += 1) % 250}`,
    headers: { "user-agent": "vitest" },
  } as unknown as TrpcContext["req"],
  res: {
    cookie: () => undefined,
    clearCookie: () => undefined,
  } as unknown as TrpcContext["res"],
});
const db = async () => (await getDb())!;
const randomLocal = () =>
  `7${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;

let server: Server;
let baseUrl = "";

function stubWhatsApp() {
  vi.stubEnv("WHATSAPP_BUSINESS_NUMBER", "+967700000001");
  vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", VERIFY_TOKEN);
}

/** يرسل رسالة واردة كما ترسلها Meta إلى Webhook (from بأرقام دون +). */
async function inbound(fromE164: string, text: string, secret = APP_SECRET) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              messages: [
                {
                  id: `wamid.${uniqueSuffix()}`,
                  from: fromE164.slice(1),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return fetch(`${baseUrl}${WHATSAPP_WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signature,
    },
    body,
  });
}

beforeAll(async () => {
  const app = express();
  registerWhatsAppWebhook(app);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>(resolve => server?.close(() => resolve())));

beforeEach(() => {
  Object.assign(ENV, {
    allowSignup: true,
    cookieSecret: "x".repeat(40),
    phoneDefaultCountryCode: "967",
  });
  stubWhatsApp();
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

/** يسجّل حساباً برقم مؤكد عبر واتساب ويعيد بيانات الدخول. */
async function registerViaWhatsApp(phone: string, name = "ولي أمر") {
  const start = await appRouter
    .createCaller(ctx())
    .auth.startWhatsAppVerification({ purpose: "signup", phone });
  expect((await inbound(phone, start.message)).status).toBe(200);
  const result = await appRouter.createCaller(ctx()).auth.register({
    name,
    phone,
    password: "Quran1234",
    phoneTicket: start.ticket,
  });
  return { result, credential: await credentialOf(phone) };
}

describeWithDb("التحقق العكسي عبر واتساب (MySQL + Webhook)", () => {
  it("يعلن الطريقتين في providers", async () => {
    const providers = await appRouter.createCaller(ctx()).auth.providers();
    expect(providers).toMatchObject({
      phoneVerification: true,
      whatsappVerification: true,
      smsVerification: false,
    });
  });

  it("يؤكد Webhook الاشتراك برمز التحقق الصحيح فقط", async () => {
    const ok = await fetch(
      `${baseUrl}${WHATSAPP_WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`
    );
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("12345");
    const bad = await fetch(
      `${baseUrl}${WHATSAPP_WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=1`
    );
    expect(bad.status).toBe(403);
  });

  it("يرفض رسالة بتوقيع خاطئ ولا يؤكد بها شيئاً", async () => {
    const phone = `+967${randomLocal()}`;
    const start = await appRouter
      .createCaller(ctx())
      .auth.startWhatsAppVerification({ purpose: "signup", phone });
    expect((await inbound(phone, start.message, "b".repeat(40))).status).toBe(
      401
    );
    expect(
      (
        await appRouter
          .createCaller(ctx())
          .auth.whatsAppVerificationStatus({ ticket: start.ticket })
      ).status
    ).toBe("pending");
  });

  it("التسجيل: رسالة من الرقم نفسه تؤكده، والتذكرة لمرة واحدة", async () => {
    const local = randomLocal();
    const phone = `+967${local}`;
    const caller = appRouter.createCaller(ctx());
    await expect(
      caller.auth.register({ name: "بلا تحقق", phone, password: "Quran1234" })
    ).rejects.toThrow(/واتساب/);
    const start = await caller.auth.startWhatsAppVerification({
      purpose: "signup",
      phone: `0${local}`,
    });
    expect(start.phone).toBe(phone);
    expect(start.link).toContain("https://wa.me/967700000001?text=");
    expect(start.message).toContain(start.code);
    // قبل وصول الرسالة لا تصلح التذكرة.
    await expect(
      caller.auth.register({
        name: "مبكر",
        phone,
        password: "Quran1234",
        phoneTicket: start.ticket,
      })
    ).rejects.toThrow(/واتساب/);
    expect(
      (await inbound(phone, `  ${start.code.toLowerCase()} `)).status
    ).toBe(200);
    expect(
      (await caller.auth.whatsAppVerificationStatus({ ticket: start.ticket }))
        .status
    ).toBe("verified");
    await caller.auth.register({
      name: "مستخدم واتساب",
      phone,
      password: "Quran1234",
      phoneTicket: start.ticket,
    });
    expect((await credentialOf(phone)).phoneVerifiedAt).toBeInstanceOf(Date);
    expect(
      (await caller.auth.whatsAppVerificationStatus({ ticket: start.ticket }))
        .status
    ).toBe("expired");
  });

  it("الرمز المرسل من رقم آخر لا يؤكد الرقم المطلوب", async () => {
    const phone = `+967${randomLocal()}`;
    const attacker = `+967${randomLocal()}`;
    const caller = appRouter.createCaller(ctx());
    const start = await caller.auth.startWhatsAppVerification({
      purpose: "signup",
      phone,
    });
    await inbound(attacker, start.message);
    expect(
      (await caller.auth.whatsAppVerificationStatus({ ticket: start.ticket }))
        .status
    ).toBe("mismatch");
    // حتى لو أرسله صاحب الرقم بعدها، الجلسة أُغلقت ويلزم رمز جديد.
    await inbound(phone, start.message);
    await expect(
      caller.auth.register({
        name: "زائر",
        phone,
        password: "Quran1234",
        phoneTicket: start.ticket,
      })
    ).rejects.toThrow(/واتساب/);
  });

  it("تذكرة غرض لا تصلح لغرض آخر ولا لرقم آخر", async () => {
    const { credential } = await registerViaWhatsApp(`+967${randomLocal()}`);
    const phone = credential.phone!;
    const caller = appRouter.createCaller(ctx());
    const reset = await caller.auth.startWhatsAppVerification({
      purpose: "reset",
      phone,
    });
    await inbound(phone, reset.message);
    const other = `+967${randomLocal()}`;
    await expect(
      caller.auth.register({
        name: "زائر",
        phone: other,
        password: "Quran1234",
        phoneTicket: reset.ticket,
      })
    ).rejects.toThrow(/واتساب/);
    // التذكرة لم تُستهلك بالمحاولة الخاطئة؛ تصلح للاستعادة.
    await caller.auth.resetPasswordWithPhone({
      phone,
      ticket: reset.ticket,
      newPassword: "Hifz56789",
    });
    await expect(
      caller.auth.login({ identifier: phone, password: "Hifz56789" })
    ).resolves.toEqual({ success: true });
  });

  it("الاستعادة: لا تكشف الأرقام غير المسجلة، ولا تصلح لرقم غير مؤكد", async () => {
    const phone = `+967${randomLocal()}`;
    const caller = appRouter.createCaller(ctx());
    const start = await caller.auth.startWhatsAppVerification({
      purpose: "reset",
      phone,
    });
    expect(start.ticket).toBeTruthy();
    await inbound(phone, start.message);
    await expect(
      caller.auth.resetPasswordWithPhone({
        phone,
        ticket: start.ticket,
        newPassword: "Hifz56789",
      })
    ).rejects.toThrow(/غير صحيح أو منتهٍ/);
  });

  it("يؤكد رقم الدخول من الإعدادات، ويضيف رقماً جديداً بكلمة المرور", async () => {
    // حساب برقم غير مؤكد (أُنشئ قبل تفعيل التحقق).
    vi.unstubAllEnvs();
    const phone = `+967${randomLocal()}`;
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "قديم", phone, password: "Quran1234" });
    stubWhatsApp();
    const credential = await credentialOf(phone);
    expect(credential.phoneVerifiedAt).toBeNull();
    const [user] = await (
      await db()
    )
      .select()
      .from(users)
      .where(eq(users.id, credential.userId));
    const me = appRouter.createCaller(ctx(user));
    const verify = await me.auth.startMyWhatsAppVerification({
      purpose: "verify",
    });
    await inbound(phone, verify.message);
    await me.auth.verifyPhone({ ticket: verify.ticket });
    expect((await credentialOf(phone)).phoneVerifiedAt).toBeInstanceOf(Date);

    const next = `+967${randomLocal()}`;
    await expect(
      me.auth.startMyWhatsAppVerification({
        purpose: "add_phone",
        phone: next,
        currentPassword: "wrong-pass1",
      })
    ).rejects.toThrow(/كلمة المرور/);
    const add = await me.auth.startMyWhatsAppVerification({
      purpose: "add_phone",
      phone: next,
      currentPassword: "Quran1234",
    });
    await inbound(next, add.message);
    // تذكرة حساب لا يستخدمها حساب آخر.
    const { credential: otherCredential } = await registerViaWhatsApp(
      `+967${randomLocal()}`
    );
    const [otherUser] = await (
      await db()
    )
      .select()
      .from(users)
      .where(eq(users.id, otherCredential.userId));
    await expect(
      appRouter.createCaller(ctx(otherUser)).auth.setLoginPhone({
        phone: next,
        currentPassword: "Quran1234",
        ticket: add.ticket,
      })
    ).rejects.toThrow(/واتساب/);
    await me.auth.setLoginPhone({
      phone: next,
      currentPassword: "Quran1234",
      ticket: add.ticket,
    });
    expect((await credentialOf(next)).phoneVerifiedAt).toBeInstanceOf(Date);
  });

  it("مع Twilio أيضاً: رمز SMS يبقى طريقة احتياطية للتسجيل", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", `AC${"1".repeat(32)}`);
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
    vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", `VA${"2".repeat(32)}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              String(url).endsWith("/Verifications")
                ? { status: "pending" }
                : { status: "approved" }
            ),
            { status: 200 }
          )
      )
    );
    const phone = `+967${randomLocal()}`;
    const caller = appRouter.createCaller(ctx());
    expect((await caller.auth.providers()).smsVerification).toBe(true);
    await expect(
      caller.auth.register({ name: "زائر", phone, password: "Quran1234" })
    ).rejects.toThrow(/واتساب، أو أدخل رمز التحقق/);
    await caller.auth.requestSignupPhoneCode({ phone });
    await caller.auth.register({
      name: "مستخدم SMS",
      phone,
      password: "Quran1234",
      phoneCode: "123456",
    });
    expect((await credentialOf(phone)).phoneVerifiedAt).toBeInstanceOf(Date);
  });
});

describeWithDb("ربط ولي الأمر بكل أبنائه برقم هاتفه (MySQL)", () => {
  type Fx = {
    centerA: number;
    centerB: number;
    circleA: number;
    managerId: number;
  };
  let fx: Fx;
  beforeAll(async () => {
    const d = await db();
    const s = uniqueSuffix();
    const [manager] = await d.insert(users).values({
      openId: `local_mgr_${s}`,
      name: "مدير المركز",
      role: "center_manager",
    });
    const managerId = Number(manager.insertId);
    const [org] = await d.insert(organizations).values({ name: `جهة ${s}` });
    const [a] = await d.insert(centers).values({
      organizationId: Number(org.insertId),
      name: `مركز أ ${s}`,
      managerId,
    });
    const [b] = await d
      .insert(centers)
      .values({ organizationId: Number(org.insertId), name: `مركز ب ${s}` });
    const centerA = Number(a.insertId);
    await d.insert(centerMemberships).values({
      userId: managerId,
      centerId: centerA,
      role: "center_manager",
      status: "active",
      isOwner: true,
    });
    const [branch] = await d
      .insert(branches)
      .values({ centerId: centerA, name: "الفرع الرئيسي" });
    const [season] = await d.insert(academicSeasons).values({
      centerId: centerA,
      name: "1448",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2027-06-30"),
    });
    const [circle] = await d.insert(circles).values({
      branchId: Number(branch.insertId),
      seasonId: Number(season.insertId),
      name: "حلقة الفجر",
    });
    fx = {
      centerA,
      centerB: Number(b.insertId),
      circleA: Number(circle.insertId),
      managerId,
    };
  });

  const studentIdsOf = async (guardianUserId: number) =>
    (
      await (
        await db()
      )
        .select()
        .from(parentStudentLinks)
        .where(eq(parentStudentLinks.guardianUserId, guardianUserId))
    )
      .map(l => l.studentId)
      .sort((x, y) => x - y);

  it("يربط كل الأبناء المطابقين بأي صيغة كُتب بها الرقم، في كل المراكز", async () => {
    const d = await db();
    const local = randomLocal();
    const phone = `+967${local}`;
    const spaced = `${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6)}`;
    const ids: number[] = [];
    for (const [centerId, guardianPhone, name] of [
      [fx.centerA, local, "عبدالله"],
      [fx.centerA, `00967${spaced}`, "فاطمة"],
      [fx.centerB, `+967 ${spaced}`, "يوسف"],
    ] as const) {
      const [row] = await d
        .insert(students)
        .values({ centerId, name, guardianPhone });
      ids.push(Number(row.insertId));
    }
    // ابن مرتبط بولي أمر آخر لا يُنقل، وطالب برقم مختلف لا يُربط.
    const [otherGuardian] = await d.insert(users).values({
      openId: `local_g_${uniqueSuffix()}`,
      name: "ولي آخر",
      role: "guardian",
    });
    const [taken] = await d.insert(students).values({
      centerId: fx.centerA,
      name: "مأخوذ",
      guardianPhone: local,
      guardianUserId: Number(otherGuardian.insertId),
    });
    await d.insert(students).values({
      centerId: fx.centerA,
      name: "غريب",
      guardianPhone: `+967${randomLocal()}`,
    });

    const { result, credential } = await registerViaWhatsApp(
      phone,
      "أبو عبدالله"
    );
    expect(result).toMatchObject({ role: "guardian", linkedChildren: 3 });
    const userId = credential.userId;
    expect(await studentIdsOf(userId)).toEqual(ids.sort((x, y) => x - y));
    const [user] = await d.select().from(users).where(eq(users.id, userId));
    expect(user.role).toBe("guardian");
    const memberships = await d
      .select()
      .from(centerMemberships)
      .where(eq(centerMemberships.userId, userId));
    expect(memberships.map(m => [m.centerId, m.role, m.status]).sort()).toEqual(
      [
        [fx.centerA, "guardian", "active"],
        [fx.centerB, "guardian", "active"],
      ].sort()
    );
    const [takenRow] = await d
      .select()
      .from(students)
      .where(eq(students.id, Number(taken.insertId)));
    expect(takenRow.guardianUserId).toBe(Number(otherGuardian.insertId));

    // ولي الأمر يرى الثلاثة في قائمة «إنجازات الابن».
    const list = await appRouter.createCaller(ctx(user)).students.list({});
    expect(list.map(s => s.id).sort((x, y) => x - y)).toEqual(
      ids.sort((x, y) => x - y)
    );
  });

  it("رقم غير مؤكد لا يربط شيئاً", async () => {
    vi.unstubAllEnvs();
    const d = await db();
    const local = randomLocal();
    await d
      .insert(students)
      .values({ centerId: fx.centerA, name: "طالب", guardianPhone: local });
    await appRouter.createCaller(ctx()).auth.register({
      name: "غير مؤكد",
      phone: `+967${local}`,
      password: "Quran1234",
    });
    const credential = await credentialOf(`+967${local}`);
    expect(await studentIdsOf(credential.userId)).toEqual([]);
  });

  it("إضافة طالب لاحقاً برقم ولي أمر مؤكد تربطه فوراً ويُخطر المدير", async () => {
    const local = randomLocal();
    const { credential } = await registerViaWhatsApp(`+967${local}`);
    expect(await studentIdsOf(credential.userId)).toEqual([]);
    const [manager] = await (
      await db()
    )
      .select()
      .from(users)
      .where(eq(users.id, fx.managerId));
    await appRouter.createCaller(ctx(manager)).students.create({
      circleId: fx.circleA,
      name: "ابن جديد",
      guardianPhone: `0${local}`,
    });
    const [created] = await (
      await db()
    )
      .select()
      .from(students)
      .where(
        and(
          eq(students.centerId, fx.centerA),
          eq(students.guardianPhone, `+967${local}`)
        )
      );
    expect(created.guardianUserId).toBe(credential.userId);
    expect(await studentIdsOf(credential.userId)).toEqual([created.id]);
  });

  it("لا يحوّل حساباً بدور آخر إلى ولي أمر", async () => {
    const d = await db();
    const local = randomLocal();
    const { credential } = await registerViaWhatsApp(`+967${local}`);
    await d
      .update(users)
      .set({ role: "teacher" })
      .where(eq(users.id, credential.userId));
    const [manager] = await d
      .select()
      .from(users)
      .where(eq(users.id, fx.managerId));
    await appRouter.createCaller(ctx(manager)).students.create({
      circleId: fx.circleA,
      name: "ابن المعلم",
      guardianPhone: local,
    });
    expect(await studentIdsOf(credential.userId)).toEqual([]);
  });

  it("أكواد ولي الأمر: كل كود يضيف ابناً دون سحب الأبناء السابقين", async () => {
    const d = await db();
    const [guardian] = await d.insert(users).values({
      openId: `local_gc_${uniqueSuffix()}`,
      name: "ولي بكودين",
      role: "user",
    });
    const guardianId = Number(guardian.insertId);
    const childIds: number[] = [];
    for (const name of ["الأول", "الثاني"]) {
      const [child] = await d
        .insert(students)
        .values({ centerId: fx.centerA, name });
      const studentId = Number(child.insertId);
      childIds.push(studentId);
      const raw = `TRTL-${uniqueSuffix().toUpperCase()}`;
      await d.insert(accessCodes).values({
        centerId: fx.centerA,
        codeHash: hashAccessCode(raw),
        codeHint: raw.slice(-4),
        role: "guardian",
        scopeJson: JSON.stringify([
          { scopeType: "student", scopeId: studentId },
        ]),
        studentId,
        createdBy: fx.managerId,
        maxUses: 1,
      });
      await redeemAccessCodeSecure({
        codeHash: hashAccessCode(raw),
        userId: guardianId,
      });
    }
    expect(await studentIdsOf(guardianId)).toEqual(childIds);
    const scopes = await d
      .select()
      .from(userScopes)
      .where(
        and(
          eq(userScopes.userId, guardianId),
          eq(userScopes.centerId, fx.centerA)
        )
      );
    expect(
      scopes
        .filter(scope => !scope.revokedAt)
        .map(scope => scope.scopeId)
        .sort((x, y) => x! - y!)
    ).toEqual(childIds);
    const [user] = await d.select().from(users).where(eq(users.id, guardianId));
    const list = await appRouter.createCaller(ctx(user)).students.list({});
    expect(list.map(student => student.id).sort((x, y) => x - y)).toEqual(
      childIds
    );
  });

  it("كود ولي أمر لا يغيّر دور عضو آخر في المركز", async () => {
    const d = await db();
    const [child] = await d
      .insert(students)
      .values({ centerId: fx.centerA, name: "ابن المدير" });
    const studentId = Number(child.insertId);
    const raw = `TRTL-${uniqueSuffix().toUpperCase()}`;
    await d.insert(accessCodes).values({
      centerId: fx.centerA,
      codeHash: hashAccessCode(raw),
      codeHint: raw.slice(-4),
      role: "guardian",
      scopeJson: JSON.stringify([{ scopeType: "student", scopeId: studentId }]),
      studentId,
      createdBy: fx.managerId,
      maxUses: 1,
    });
    await expect(
      redeemAccessCodeSecure({
        codeHash: hashAccessCode(raw),
        userId: fx.managerId,
      })
    ).rejects.toThrow("دور آخر");
    const [membership] = await d
      .select()
      .from(centerMemberships)
      .where(
        and(
          eq(centerMemberships.userId, fx.managerId),
          eq(centerMemberships.centerId, fx.centerA)
        )
      );
    expect(membership.role).toBe("center_manager");
  });
});
