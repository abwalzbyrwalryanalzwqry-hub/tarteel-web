/**
 * الدخول المحلي لترتيل: بريد + كلمة مرور، وجلسة JWT في كوكي httpOnly.
 * لا يعتمد على أي خدمة خارجية أو بريد أو نطاق؛ يعمل على أي استضافة Node + MySQL.
 */
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { localCredentials, passwordSetupTokens, users, type User } from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { actionEmail, isEmailConfigured, sendEmail } from "../_core/email";
import { hitRateLimit } from "../data/usage-limits";
import { isGoogleConfigured } from "./google";
import { getClientIp } from "../_core/request";
import { isAccountUsable, sdk } from "../_core/sdk";
import { protectedProcedure, publicProcedure } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import * as db from "../db";
import { INVALID_INVITE_MESSAGE, classifyInviteCode, discardNewAccount, isInviteUsable, redeemSignupInvite } from "./inviteSignup";
import {
  LOCK_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  PASSWORD_MAX_LENGTH,
  consumeRateLimit,
  createSetupToken,
  getDummyHash,
  getPasswordPolicyError,
  hashPassword,
  hashSetupToken,
  normalizeEmail,
  verifyPassword,
} from "./password";

const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
export const LOCAL_OPEN_ID_PREFIX = "local_";

const emailSchema = z.string().trim().min(3).max(320).email("صيغة البريد غير صحيحة");
const passwordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);

const fail = (code: TRPCError["code"], message: string) => new TRPCError({ code, message });

async function requireDb() {
  const database = await db.getDb();
  if (!database) throw fail("INTERNAL_SERVER_ERROR", "قاعدة البيانات غير متاحة");
  return database;
}

function assertPolicy(password: string) {
  const error = getPasswordPolicyError(password);
  if (error) throw fail("BAD_REQUEST", error);
}

/** مفتاح حد المحاولات: IP الحقيقي كما يحسبه Express خلف الوكيل، لا قيمة X-Forwarded-For التي يرسلها العميل. */
export function clientKey(ctx: Pick<TrpcContext, "req">) {
  return getClientIp(ctx.req);
}

const isUserActive = isAccountUsable;

async function issueSession(ctx: TrpcContext, user: Pick<User, "openId" | "name" | "email" | "sessionVersion">) {
  await sdk.issueSessionCookie(ctx.req, ctx.res, user);
}

/** يبطل كل الجلسات السابقة للمستخدم ثم يصدر جلسة جديدة لهذا الجهاز فقط. */
async function rotateSessions(ctx: TrpcContext, user: Pick<User, "id" | "openId" | "name" | "email">) {
  const sessionVersion = await db.bumpSessionVersion(user.id);
  await issueSession(ctx, { ...user, sessionVersion });
}

async function audit(userId: number | null, action: string, entityId: number | null, ctx: TrpcContext, data?: Record<string, unknown>) {
  try {
    await db.createAuditLog({
      userId,
      action,
      entity: "auth",
      entityId,
      newData: data ? JSON.stringify(data) : null,
      ipAddress: clientKey(ctx).slice(0, 64),
      userAgent: String(ctx.req.headers?.["user-agent"] ?? "").slice(0, 512) || null,
    });
  } catch (error) {
    console.warn("[Auth] audit log failed", error);
  }
}

async function findCredentialByEmail(email: string) {
  const database = await requireDb();
  const rows = await database.select().from(localCredentials).where(eq(localCredentials.email, email)).limit(1);
  return rows[0];
}

async function findCredentialByUserId(userId: number) {
  const database = await requireDb();
  const rows = await database.select().from(localCredentials).where(eq(localCredentials.userId, userId)).limit(1);
  return rows[0];
}

async function saveCredential(userId: number, email: string, password: string) {
  const database = await requireDb();
  const owner = await findCredentialByEmail(email);
  if (owner && owner.userId !== userId) throw fail("CONFLICT", "هذا البريد مستخدم في حساب آخر");
  const passwordHash = await hashPassword(password);
  const existing = await findCredentialByUserId(userId);
  if (existing) {
    await database.update(localCredentials).set({ email, passwordHash, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() }).where(eq(localCredentials.id, existing.id));
  } else {
    await database.insert(localCredentials).values({ userId, email, passwordHash });
  }
  const user = (await database.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (user && !user.email) await database.update(users).set({ email }).where(eq(users.id, userId));
}

/** يُستخدم أيضاً من سكربت create-admin. */
export async function createLocalUser(input: { name: string; email: string; password: string; role?: User["role"] }) {
  const database = await requireDb();
  const email = normalizeEmail(input.email);
  if (await findCredentialByEmail(email)) throw fail("CONFLICT", "يوجد حساب مسجّل بهذا البريد");
  const openId = `${LOCAL_OPEN_ID_PREFIX}${randomBytes(12).toString("hex")}`;
  // الدور الإداري يُمنح فقط صراحةً (سكربت create-admin)، لا بمطابقة بريد غير متحقق منه.
  const role = input.role;
  await db.upsertUser({ openId, name: input.name.trim(), email, loginMethod: "password", lastSignedIn: new Date(), ...(role ? { role } : {}) });
  const user = await db.getUserByOpenId(openId);
  if (!user) throw fail("INTERNAL_SERVER_ERROR", "تعذر إنشاء الحساب");
  await database.insert(localCredentials).values({ userId: user.id, email, passwordHash: await hashPassword(input.password) });
  return user;
}

export async function createPasswordSetupToken(userId: number, createdBy: number | null) {
  const database = await requireDb();
  const token = createSetupToken();
  await database.insert(passwordSetupTokens).values({ userId, tokenHash: hashSetupToken(token), createdBy, purpose: "setup", expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS) });
  return { token, path: `/set-password?token=${encodeURIComponent(token)}`, expiresInHours: SETUP_TOKEN_TTL_MS / 3_600_000 };
}

// ── البريد التشغيلي: استعادة كلمة المرور وتأكيد البريد (يعمل فقط مع مزود بريد وPUBLIC_APP_URL) ──
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const VERIFY_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

/** البريد جاهز فقط مع عنوان عام ثابت؛ لا نبني روابط البريد من ترويسة Host. */
export const isEmailFlowReady = () => isEmailConfigured() && Boolean(ENV.publicAppUrl);

async function issueEmailToken(userId: number, purpose: "reset" | "verify_email", ttlMs: number) {
  const database = await requireDb();
  // رابط واحد صالح لكل غرض: الروابط الأقدم لم تعد تعمل.
  await database.update(passwordSetupTokens).set({ usedAt: new Date() }).where(and(eq(passwordSetupTokens.userId, userId), eq(passwordSetupTokens.purpose, purpose), isNull(passwordSetupTokens.usedAt)));
  const token = createSetupToken();
  await database.insert(passwordSetupTokens).values({ userId, tokenHash: hashSetupToken(token), purpose, createdBy: null, expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

export async function sendVerificationEmail(user: Pick<User, "id" | "name">, email: string) {
  if (!isEmailFlowReady()) return false;
  const token = await issueEmailToken(user.id, "verify_email", VERIFY_TOKEN_TTL_MS);
  return sendEmail(actionEmail({
    to: email,
    subject: "تأكيد بريدك في ترتيل",
    greeting: `مرحباً ${user.name ?? ""}،`.replace(" ،", "،"),
    body: "اضغط الزر لتأكيد أن هذا البريد لك. التأكيد يتيح استعادة كلمة المرور إن نسيتها.",
    actionLabel: "تأكيد البريد",
    actionUrl: `${ENV.publicAppUrl}/verify-email?token=${encodeURIComponent(token)}`,
    footer: "الرابط صالح 48 ساعة. إن لم تنشئ حساباً في ترتيل فتجاهل هذه الرسالة.",
  }));
}

export const localAuthRouter = {
  /** ما تعرضه صفحة الدخول. */
  providers: publicProcedure.query(() => ({
    local: true,
    allowSignup: ENV.allowSignup,
    /** إنشاء حساب برمز دعوة أو كود دخول متاح دائماً، حتى حين يكون التسجيل العام مغلقاً. */
    inviteSignup: true,
    /** «نسيت كلمة المرور» بالبريد: يلزم مزود بريد وPUBLIC_APP_URL. */
    passwordReset: isEmailFlowReady(),
    google: isGoogleConfigured(),
  })),

  /** يرسل رابط استعادة إن وُجد حساب بهذا البريد. الرد واحد دائماً حتى لا يكشف أي البريدات مسجّلة. */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!isEmailFlowReady()) throw fail("PRECONDITION_FAILED", "استعادة كلمة المرور بالبريد غير مفعّلة؛ اطلب من إدارة المركز رابط تعيين كلمة مرور.");
      if (!(await consumeRateLimit(`reset:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      const email = normalizeEmail(input.email);
      // حد لكل بريد أيضاً: لا يُستخدم النموذج لإغراق صندوق شخص بالرسائل.
      if (!(await hitRateLimit(`reset-email:${email}`, { max: 3, windowMs: 60 * 60 * 1000 }))) return { success: true } as const;
      const credential = await findCredentialByEmail(email);
      if (credential) {
        const database = await requireDb();
        const user = (await database.select().from(users).where(eq(users.id, credential.userId)).limit(1))[0];
        if (user && isUserActive(user)) {
          const token = await issueEmailToken(user.id, "reset", RESET_TOKEN_TTL_MS);
          await sendEmail(actionEmail({
            to: credential.email,
            subject: "استعادة كلمة المرور في ترتيل",
            greeting: `مرحباً ${user.name ?? ""}،`.replace(" ،", "،"),
            body: "وصلنا طلب لتعيين كلمة مرور جديدة لحسابك. اضغط الزر لاختيارها؛ ستُغلق بعدها كل الجلسات المفتوحة على الأجهزة الأخرى.",
            actionLabel: "تعيين كلمة مرور جديدة",
            actionUrl: `${ENV.publicAppUrl}/set-password?token=${encodeURIComponent(token)}&reset=1`,
            footer: "الرابط صالح 30 دقيقة ولمرة واحدة. إن لم تطلب ذلك فتجاهل الرسالة؛ كلمة مرورك الحالية لم تتغير.",
          }));
          await audit(user.id, "auth.password_reset_requested", user.id, ctx);
        }
      }
      return { success: true } as const;
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().trim().min(20).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await consumeRateLimit(`verify:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      const database = await requireDb();
      const row = (await database.select().from(passwordSetupTokens).where(and(
        eq(passwordSetupTokens.tokenHash, hashSetupToken(input.token)),
        eq(passwordSetupTokens.purpose, "verify_email"),
        isNull(passwordSetupTokens.usedAt),
        gt(passwordSetupTokens.expiresAt, new Date()),
      )).limit(1))[0];
      if (!row) throw fail("BAD_REQUEST", "رابط التأكيد غير صالح أو منتهٍ؛ اطلب رابطاً جديداً من الإعدادات");
      await database.update(passwordSetupTokens).set({ usedAt: new Date() }).where(eq(passwordSetupTokens.id, row.id));
      await database.update(localCredentials).set({ emailVerifiedAt: new Date() }).where(eq(localCredentials.userId, row.userId));
      await audit(row.userId, "auth.email_verified", row.userId, ctx);
      return { success: true } as const;
    }),

  emailStatus: protectedProcedure.query(async ({ ctx }) => {
    const credential = await findCredentialByUserId(ctx.user.id);
    return { email: credential?.email ?? null, verified: Boolean(credential?.emailVerifiedAt), canSend: isEmailFlowReady() && Boolean(credential) };
  }),

  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isEmailFlowReady()) throw fail("PRECONDITION_FAILED", "إرسال البريد غير مفعّل على هذا الخادم");
    const credential = await findCredentialByUserId(ctx.user.id);
    if (!credential) throw fail("BAD_REQUEST", "لا يوجد بريد دخول لهذا الحساب");
    if (credential.emailVerifiedAt) return { success: true, alreadyVerified: true } as const;
    if (!(await hitRateLimit(`verify-send:${ctx.user.id}`, { max: 3, windowMs: 60 * 60 * 1000 }))) throw fail("TOO_MANY_REQUESTS", "أُرسلت عدة رسائل؛ حاول بعد ساعة");
    const sent = await sendVerificationEmail(ctx.user, credential.email);
    if (!sent) throw fail("INTERNAL_SERVER_ERROR", "تعذر إرسال الرسالة الآن؛ حاول لاحقاً");
    return { success: true, alreadyVerified: false } as const;
  }),

  register: publicProcedure
    .input(z.object({
      name: z.string().trim().min(2, "الاسم قصير جداً").max(120),
      email: emailSchema,
      password: passwordSchema,
      inviteCode: z.string().trim().max(128).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const invite = input.inviteCode ? classifyInviteCode(input.inviteCode) : null;
      if (input.inviteCode && !invite) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);
      if (!ENV.allowSignup && !invite) throw fail("FORBIDDEN", "إنشاء الحسابات مغلق إلا برمز دعوة؛ أدخل رمز الدعوة أو كود الدخول الذي وصلك من إدارة المركز");
      if (!(await consumeRateLimit(`register:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      assertPolicy(input.password);
      // لا نربط تلقائياً بحساب قديم يحمل البريد نفسه (مثل حساب أُنشئ بنظام الدخول السابق) لأن البريد غير مُتحقق منه؛
      // صاحب الحساب القديم يعيّن كلمة مروره من الإعدادات أو برابط من المدير.
      if (await findCredentialByEmail(email)) throw fail("CONFLICT", "يوجد حساب مسجّل بهذا البريد. سجّل الدخول بدلاً من ذلك");
      const database = await requireDb();
      const legacy = await database.select({ id: users.id }).from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1);
      if (legacy.length) throw fail("CONFLICT", "هذا البريد مرتبط بحساب موجود. سجّل الدخول بالطريقة السابقة وعيّن كلمة مرور من الإعدادات، أو اطلب من المدير رابط تعيين كلمة المرور.");
      if (invite && !(await isInviteUsable(invite))) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);

      const user = await createLocalUser({ name: input.name, email, password: input.password });
      let granted: { role: string; centerId?: number } | null = null;
      if (invite) {
        try {
          granted = await redeemSignupInvite(invite, user.id, { ipAddress: clientKey(ctx), userAgent: String(ctx.req.headers?.["user-agent"] ?? "").slice(0, 512) || undefined });
        } catch (error) {
          // الرمز صار غير صالح بين الفحص والاسترداد: لا نترك حساباً بلا دعوة.
          await discardNewAccount(user.id).catch((discardError) => console.warn("[Auth] discard failed", String(discardError)));
          throw fail("BAD_REQUEST", error instanceof Error ? error.message : INVALID_INVITE_MESSAGE);
        }
      }
      const fresh = (await database.select().from(users).where(eq(users.id, user.id)).limit(1))[0] ?? user;
      await issueSession(ctx, fresh);
      // تأكيد البريد لا يمنع الدخول؛ يُرسل في الخلفية إن كان البريد مفعّلاً.
      void sendVerificationEmail(fresh, email).catch((error) => console.warn("[Auth] verification email failed", String(error)));
      await audit(user.id, invite ? "auth.register_invite" : "auth.register", user.id, ctx, granted ? { inviteKind: invite!.kind, role: granted.role, centerId: granted.centerId } : undefined);
      return { success: true, role: granted?.role ?? null } as const;
    }),

  login: publicProcedure
    .input(z.object({ email: emailSchema, password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      if (!(await consumeRateLimit(`login:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول بعد ربع ساعة");
      const credential = await findCredentialByEmail(email);
      const invalid = fail("UNAUTHORIZED", "البريد أو كلمة المرور غير صحيحة");
      if (!credential) {
        await verifyPassword(input.password, await getDummyHash());
        throw invalid;
      }
      if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
        throw fail("TOO_MANY_REQUESTS", "الحساب مقفل مؤقتاً بسبب محاولات خاطئة متكررة، حاول بعد ربع ساعة");
      }
      const database = await requireDb();
      const ok = await verifyPassword(input.password, credential.passwordHash);
      if (!ok) {
        const failed = credential.failedAttempts + 1;
        await database.update(localCredentials).set({
          failedAttempts: failed >= MAX_FAILED_ATTEMPTS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : credential.lockedUntil,
        }).where(eq(localCredentials.id, credential.id));
        await audit(credential.userId, "auth.login_failed", credential.userId, ctx);
        throw invalid;
      }
      const user = (await database.select().from(users).where(eq(users.id, credential.userId)).limit(1))[0];
      if (!user || !isUserActive(user)) throw fail("FORBIDDEN", "حسابك غير نشط. تواصل مع إدارة المركز");
      await database.update(localCredentials).set({ failedAttempts: 0, lockedUntil: null }).where(eq(localCredentials.id, credential.id));
      await issueSession(ctx, user);
      await audit(user.id, "auth.login", user.id, ctx);
      return { success: true } as const;
    }),

  /** حالة كلمة المرور للمستخدم الحالي (لصفحة الإعدادات). */
  myCredential: protectedProcedure.query(async ({ ctx }) => {
    const credential = await findCredentialByUserId(ctx.user.id);
    return { hasPassword: Boolean(credential), email: credential?.email ?? ctx.user.email ?? null };
  }),

  /** تعيين/تغيير كلمة المرور من داخل الجلسة — وهو أيضاً مسار المستخدمين القدامى لتعيين أول كلمة مرور. */
  setPassword: protectedProcedure
    .input(z.object({ email: emailSchema.optional(), currentPassword: passwordSchema.optional(), newPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      assertPolicy(input.newPassword);
      const existing = await findCredentialByUserId(ctx.user.id);
      if (existing) {
        if (!input.currentPassword || !(await verifyPassword(input.currentPassword, existing.passwordHash))) {
          throw fail("UNAUTHORIZED", "كلمة المرور الحالية غير صحيحة");
        }
      }
      const email = normalizeEmail(input.email ?? existing?.email ?? ctx.user.email ?? "");
      if (!email) throw fail("BAD_REQUEST", "أدخل البريد الذي ستستخدمه للدخول");
      await saveCredential(ctx.user.id, email, input.newPassword);
      // تغيير كلمة المرور يُخرج كل الأجهزة الأخرى؛ الجهاز الحالي يبقى داخلاً بجلسة جديدة.
      await rotateSessions(ctx, ctx.user);
      await audit(ctx.user.id, existing ? "auth.password_changed" : "auth.password_set", ctx.user.id, ctx);
      return { success: true, email } as const;
    }),

  /** الخروج من كل الأجهزة: يبطل كل الجلسات بما فيها الحالية. */
  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    await db.bumpSessionVersion(ctx.user.id);
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    await audit(ctx.user.id, "auth.logout_all", ctx.user.id, ctx);
    return { success: true } as const;
  }),

  /** المدير العام ينشئ رابط تعيين كلمة مرور لمستخدم (صالح 72 ساعة ولمرة واحدة). */
  createSetupLink: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ADMIN_ROLES.has(ctx.user.role)) throw fail("FORBIDDEN", "إنشاء روابط كلمة المرور من صلاحية المدير العام");
      const database = await requireDb();
      const target = (await database.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target || target.deletedAt) throw fail("NOT_FOUND", "المستخدم غير موجود");
      const link = await createPasswordSetupToken(target.id, ctx.user.id);
      await audit(ctx.user.id, "auth.setup_link_created", target.id, ctx);
      return link;
    }),

  completeSetup: publicProcedure
    .input(z.object({ token: z.string().trim().min(20).max(200), email: emailSchema.optional(), password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!(await consumeRateLimit(`setup:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      assertPolicy(input.password);
      const database = await requireDb();
      const row = (await database.select().from(passwordSetupTokens).where(and(
        eq(passwordSetupTokens.tokenHash, hashSetupToken(input.token)),
        // رابط تأكيد البريد لا يصلح لتعيين كلمة مرور.
        inArray(passwordSetupTokens.purpose, ["setup", "reset"]),
        isNull(passwordSetupTokens.usedAt),
        gt(passwordSetupTokens.expiresAt, new Date()),
      )).limit(1))[0];
      if (!row) throw fail("BAD_REQUEST", "الرابط غير صالح أو منتهي أو مستخدم من قبل");
      const user = (await database.select().from(users).where(eq(users.id, row.userId)).limit(1))[0];
      if (!user || !isUserActive(user)) throw fail("FORBIDDEN", "الحساب غير نشط");
      const existing = await findCredentialByUserId(user.id);
      const email = normalizeEmail(existing?.email ?? input.email ?? user.email ?? "");
      if (!email) throw fail("BAD_REQUEST", "أدخل البريد الذي ستستخدمه للدخول");
      // نعلّم الرابط مستخدماً أولاً (حماية من الاستخدام المزدوج المتزامن).
      const marked = await database.update(passwordSetupTokens).set({ usedAt: new Date() }).where(and(eq(passwordSetupTokens.id, row.id), isNull(passwordSetupTokens.usedAt)));
      const affected = (marked as unknown as [{ affectedRows?: number }])[0]?.affectedRows;
      if (affected === 0) throw fail("BAD_REQUEST", "الرابط مستخدم من قبل");
      await saveCredential(user.id, email, input.password);
      // رابط الاستعادة وصل إلى هذا البريد، فهو مؤكد.
      if (row.purpose === "reset") await database.update(localCredentials).set({ emailVerifiedAt: new Date() }).where(eq(localCredentials.userId, user.id));
      await rotateSessions(ctx, user);
      await audit(user.id, row.purpose === "reset" ? "auth.password_reset_completed" : "auth.setup_completed", user.id, ctx);
      return { success: true, email } as const;
    }),
};
