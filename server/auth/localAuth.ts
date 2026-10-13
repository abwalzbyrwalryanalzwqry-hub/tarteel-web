/**
 * الدخول المحلي لترتيل: بريد أو رقم هاتف + كلمة مرور، وجلسة JWT في كوكي httpOnly.
 * رقم الهاتف يُحفظ بصيغة E.164 الموحّدة. يُؤكَّد الرقم عند التسجيل وعند إضافته، وتصبح استعادة كلمة المرور
 * بالهاتف ممكنة، بإحدى طريقتين أو كلتيهما:
 *  - واتساب عكسي مجاني (server/_core/whatsapp.ts): المستخدم يرسل رمزاً من واتساب رقمه؛ الإثبات تذكرة (phoneTicket).
 *  - رمز SMS عبر Twilio Verify (server/_core/sms.ts) احتياطياً؛ الإثبات رمز (phoneCode/code).
 * بدونهما يبقى الرقم معرّف دخول غير مؤكد، والاستعادة برابط تعيين من إدارة المركز.
 * بعد تأكيد الرقم يُربط الحساب تلقائياً بكل طالب سجّل المركز هذا الرقم رقماً لولي أمره (server/data/guardian-links.ts).
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
import { looksLikePhone, normalizePhone } from "../../shared/phone";
import { SMS_FAILURE_MESSAGES, SmsError, checkPhoneVerification, isSmsConfigured, startPhoneVerification } from "../_core/sms";
import { isWhatsAppConfigured } from "../_core/whatsapp";
import { consumeWhatsAppVerification, getWhatsAppVerificationStatus, startWhatsAppVerification } from "./whatsappVerification";
import { linkGuardianChildrenByPhone } from "../data/guardian-links";
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
import { logger } from "../_core/logger";
import { isSqliteDialect } from "../data/dialect";
import { getUserCenterMemberships } from "../data/access-control";

const SETUP_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
export const LOCAL_OPEN_ID_PREFIX = "local_";

const emailSchema = z.string().trim().min(3).max(320).email("صيغة البريد غير صحيحة");
const passwordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);
const phoneInputSchema = z.string().trim().min(6).max(32);
/** حقل «البريد أو رقم الهاتف» في صفحة الدخول. */
const identifierSchema = z.string().trim().min(3).max(320);

export const INVALID_PHONE_MESSAGE = "رقم الهاتف غير صحيح. اكتبه مع رمز الدولة مثل ‎+967771234567 أو محلياً مثل 771234567";

export type LoginIdentity = { email?: string | null; phone?: string | null };

/** يوحّد رقم الهاتف برمز الدولة الافتراضي للخادم، أو يرمي خطأً عربياً واضحاً. */
export function requirePhone(raw: string) {
  const phone = normalizePhone(raw, ENV.phoneDefaultCountryCode);
  if (!phone) throw fail("BAD_REQUEST", INVALID_PHONE_MESSAGE);
  return phone;
}

/** يميّز بين بريد ورقم هاتف في حقل واحد. */
export function parseIdentifier(raw: string): { email: string } | { phone: string } {
  if (looksLikePhone(raw)) return { phone: requirePhone(raw) };
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) throw fail("BAD_REQUEST", "أدخل بريداً إلكترونياً صحيحاً أو رقم هاتف");
  return { email: normalizeEmail(parsed.data) };
}

/** يحوّل الحقول الاختيارية (identifier أو email أو phone) إلى هوية واحدة موحّدة، أو null إن كانت كلها فارغة. */
function identityFromInput(input: { identifier?: string; email?: string; phone?: string }): LoginIdentity | null {
  if (input.identifier?.trim()) return parseIdentifier(input.identifier);
  const identity: LoginIdentity = {};
  if (input.email?.trim()) identity.email = normalizeEmail(input.email);
  if (input.phone?.trim()) identity.phone = requirePhone(input.phone);
  return identity.email || identity.phone ? identity : null;
}

const phoneCodeSchema = z.string().trim().min(4).max(12);
export const INVALID_PHONE_CODE_MESSAGE = "رمز التحقق غير صحيح أو منتهٍ؛ اطلب رمزاً جديداً";
const SMS_WINDOW_MS = 60 * 60 * 1000;

function smsFailure(error: unknown): never {
  if (error instanceof SmsError) {
    throw fail(error.reason === "too_many" ? "TOO_MANY_REQUESTS" : error.reason === "unavailable" ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST", SMS_FAILURE_MESSAGES[error.reason]);
  }
  throw error;
}

function requireSms() {
  if (!isSmsConfigured()) throw fail("PRECONDITION_FAILED", "التحقق برسالة SMS غير مفعّل على هذا الخادم");
}

const phoneTicketSchema = z.string().trim().min(20).max(100);
export const INVALID_WHATSAPP_PROOF_MESSAGE = "لم يكتمل التحقق عبر واتساب أو انتهت مهلته؛ ابدأ التحقق من جديد";
type VerificationPurpose = "signup" | "reset" | "verify" | "add_phone";
/** أي طريقة لإثبات امتلاك الرقم مفعّلة (واتساب أو SMS). */
const isPhoneVerificationEnabled = () => isWhatsAppConfigured() || isSmsConfigured();

function requirePhoneVerification() {
  if (!isPhoneVerificationEnabled()) throw fail("PRECONDITION_FAILED", "التحقق من رقم الهاتف غير مفعّل على هذا الخادم");
}

function requireWhatsApp() {
  if (!isWhatsAppConfigured()) throw fail("PRECONDITION_FAILED", "التحقق عبر واتساب غير مفعّل على هذا الخادم");
}

function missingProofMessage() {
  const whatsapp = isWhatsAppConfigured();
  const sms = isSmsConfigured();
  if (whatsapp && sms) return "أكّد رقمك عبر واتساب، أو أدخل رمز التحقق الذي وصلك برسالة SMS";
  if (whatsapp) return "أكّد رقمك عبر واتساب أولاً";
  return "أدخل رمز التحقق الذي وصلك برسالة SMS";
}

/**
 * يثبت امتلاك الرقم: تذكرة واتساب مؤكدة لهذا الرقم والغرض (تُستهلك مرة واحدة)، أو رمز SMS من Twilio.
 */
async function verifyPhoneProof(phone: string, proof: { code?: string; ticket?: string }, purpose: VerificationPurpose, userId?: number) {
  if (proof.ticket) {
    requireWhatsApp();
    if (!(await consumeWhatsAppVerification({ ticket: proof.ticket, phone, purpose, userId }))) throw fail("BAD_REQUEST", INVALID_WHATSAPP_PROOF_MESSAGE);
    return;
  }
  if (proof.code) {
    requireSms();
    await verifyPhoneCode(phone, proof.code);
    return;
  }
  throw fail("BAD_REQUEST", missingProofMessage());
}

/** ربط الأبناء بعد تأكيد الرقم؛ فشله لا يُفشل الدخول أو التسجيل. */
async function linkChildrenSafely(userId: number, phone: string) {
  try {
    return (await linkGuardianChildrenByPhone(userId, phone)).linked;
  } catch (error) {
    logger.warn({ err: error }, "[Auth] guardian auto-link failed");
    return 0;
  }
}

/** حدود بدء جلسات واتساب: لكل IP ولكل رقم ولكل حساب إن وُجد. */
async function limitWhatsAppStart(ctx: TrpcContext, phone: string, userId?: number) {
  if (!(await hitRateLimit(`wa-start-ip:${clientKey(ctx)}`, { max: 15, windowMs: SMS_WINDOW_MS }))) throw fail("TOO_MANY_REQUESTS", "طلبات تحقق كثيرة من هذا الجهاز؛ حاول بعد ساعة");
  if (!(await hitRateLimit(`wa-start-phone:${phone}`, { max: 6, windowMs: SMS_WINDOW_MS }))) throw fail("TOO_MANY_REQUESTS", "طلبات تحقق كثيرة لهذا الرقم؛ حاول بعد ساعة");
  if (userId && !(await hitRateLimit(`wa-start-user:${userId}`, { max: 8, windowMs: SMS_WINDOW_MS }))) throw fail("TOO_MANY_REQUESTS", "طلبات تحقق كثيرة؛ حاول بعد ساعة");
}

function publicStart(start: Awaited<ReturnType<typeof startWhatsAppVerification>>, phone: string) {
  return { phone, ticket: start.ticket, code: start.code, message: start.message, link: start.link, businessNumber: start.businessNumber, expiresAt: start.expiresAt };
}

/**
 * يرسل رمز SMS بعد حدود المحاولات: لكل IP (يمنع إغراق الأرقام برسائل مدفوعة) ولكل رقم (3 في الساعة)
 * ولكل حساب إن وُجد. Twilio يطبق حدوده أيضاً (5 رسائل لكل رقم في 10 دقائق).
 */
async function sendPhoneCode(ctx: TrpcContext, phone: string, scope: string, userId?: number) {
  if (!(await hitRateLimit(`sms-ip:${clientKey(ctx)}`, { max: 10, windowMs: SMS_WINDOW_MS }))) throw fail("TOO_MANY_REQUESTS", "طلبات رموز كثيرة من هذا الجهاز؛ حاول بعد ساعة");
  if (!(await hitRateLimit(`sms-phone:${phone}`, { max: 3, windowMs: SMS_WINDOW_MS }))) throw fail("TOO_MANY_REQUESTS", SMS_FAILURE_MESSAGES.too_many);
  if (userId && !(await hitRateLimit(`sms-user:${userId}`, { max: 5, windowMs: SMS_WINDOW_MS }))) throw fail("TOO_MANY_REQUESTS", "طلبات رموز كثيرة؛ حاول بعد ساعة");
  try {
    await startPhoneVerification(phone);
  } catch (error) {
    smsFailure(error);
  }
  await audit(userId ?? null, "auth.phone_code_sent", userId ?? null, ctx, { scope });
}

/** يتحقق من رمز SMS، مع حد لمحاولات الإدخال لكل رقم فوق حد Twilio. */
async function verifyPhoneCode(phone: string, code: string) {
  if (!(await hitRateLimit(`sms-check:${phone}`, { max: 10, windowMs: SMS_WINDOW_MS }))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة لإدخال الرمز؛ حاول بعد ساعة");
  let approved = false;
  try {
    approved = await checkPhoneVerification(phone, code);
  } catch (error) {
    smsFailure(error);
  }
  if (!approved) throw fail("BAD_REQUEST", INVALID_PHONE_CODE_MESSAGE);
}

/** وصف معرّف الدخول للرسائل: «البريد x» أو «رقم الهاتف y». */
export function describeIdentity(identity: LoginIdentity) {
  return identity.email ? `البريد ${identity.email}` : identity.phone ? `رقم الهاتف ${identity.phone}` : "";
}

const fail = (code: TRPCError["code"], message: string) => new TRPCError({ code, message });

async function requireDb() {
  const database = await db.getDb();
  if (!database) throw fail("INTERNAL_SERVER_ERROR", "قاعدة البيانات غير متاحة");
  return database;
}

/** المستخدم مالك نشط لمركز فيه عضوية للمستخدم الآخر (ليس مالكاً فيه)، ولا يصدر لنفسه. */
async function ownsCenterOf(ownerId: number, targetId: number) {
  if (ownerId === targetId) return false;
  const now = Date.now();
  const live = (membership: { status: string; revokedAt: Date | null; expiresAt: Date | null }) =>
    membership.status === "active" && !membership.revokedAt && (!membership.expiresAt || membership.expiresAt.getTime() > now);
  const owned = new Set((await getUserCenterMemberships(ownerId)).filter((membership) => membership.isOwner && live(membership)).map((membership) => membership.centerId));
  if (!owned.size) return false;
  return (await getUserCenterMemberships(targetId)).some((membership) => owned.has(membership.centerId) && !membership.isOwner && !membership.revokedAt);
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
    logger.warn({ err: error }, "[Auth] audit log failed");
  }
}

async function findCredentialByEmail(email: string) {
  const database = await requireDb();
  const rows = await database.select().from(localCredentials).where(eq(localCredentials.email, email)).limit(1);
  return rows[0];
}

async function findCredentialByPhone(phone: string) {
  const database = await requireDb();
  const rows = await database.select().from(localCredentials).where(eq(localCredentials.phone, phone)).limit(1);
  return rows[0];
}

function findCredentialByIdentity(identity: LoginIdentity) {
  if (identity.email) return findCredentialByEmail(identity.email);
  if (identity.phone) return findCredentialByPhone(identity.phone);
  return Promise.resolve(undefined);
}

async function findCredentialByUserId(userId: number) {
  const database = await requireDb();
  const rows = await database.select().from(localCredentials).where(eq(localCredentials.userId, userId)).limit(1);
  return rows[0];
}

async function assertIdentityFree(identity: LoginIdentity, userId: number | null) {
  if (identity.email) {
    const owner = await findCredentialByEmail(identity.email);
    if (owner && owner.userId !== userId) throw fail("CONFLICT", "هذا البريد مستخدم في حساب آخر");
  }
  if (identity.phone) {
    const owner = await findCredentialByPhone(identity.phone);
    if (owner && owner.userId !== userId) throw fail("CONFLICT", "رقم الهاتف هذا مستخدم في حساب آخر");
  }
}

/** يحفظ كلمة المرور؛ المعرّف الجديد (بريد أو هاتف) يُضاف إلى المعرّف الموجود ولا يحذفه. */
async function saveCredential(userId: number, identity: LoginIdentity, password: string) {
  const database = await requireDb();
  await assertIdentityFree(identity, userId);
  const passwordHash = await hashPassword(password);
  const existing = await findCredentialByUserId(userId);
  const email = identity.email ?? existing?.email ?? null;
  const phone = identity.phone ?? existing?.phone ?? null;
  if (!email && !phone) throw fail("BAD_REQUEST", "أدخل البريد أو رقم الهاتف الذي ستستخدمه للدخول");
  // رقم جديد غير مؤكد حتى يُثبت برمز SMS.
  const phoneVerifiedAt = existing && phone === existing.phone ? existing.phoneVerifiedAt : null;
  if (existing) {
    await database.update(localCredentials).set({ email, phone, phoneVerifiedAt, passwordHash, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() }).where(eq(localCredentials.id, existing.id));
  } else {
    await database.insert(localCredentials).values({ userId, email, phone, passwordHash });
  }
  const user = (await database.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (user && ((email && !user.email) || (phone && !user.phone))) {
    await database.update(users).set({ email: user.email || email, phone: user.phone || phone }).where(eq(users.id, userId));
  }
  return { email, phone };
}

/** يُستخدم أيضاً من سكربت create-admin. */
export async function createLocalUser(input: { name: string; email?: string | null; phone?: string | null; phoneVerified?: boolean; password: string; role?: User["role"] }) {
  const database = await requireDb();
  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = input.phone ? requirePhone(input.phone) : null;
  if (!email && !phone) throw fail("BAD_REQUEST", "أدخل البريد أو رقم الهاتف");
  if (email && (await findCredentialByEmail(email))) throw fail("CONFLICT", "يوجد حساب مسجّل بهذا البريد");
  if (phone && (await findCredentialByPhone(phone))) throw fail("CONFLICT", "يوجد حساب مسجّل برقم الهاتف هذا");
  const openId = `${LOCAL_OPEN_ID_PREFIX}${randomBytes(12).toString("hex")}`;
  // الدور الإداري يُمنح فقط صراحةً (سكربت create-admin)، لا بمطابقة بريد غير متحقق منه.
  const role = input.role;
  await db.upsertUser({ openId, name: input.name.trim(), email, loginMethod: "password", lastSignedIn: new Date(), ...(role ? { role } : {}) });
  let user = await db.getUserByOpenId(openId);
  if (!user) throw fail("INTERNAL_SERVER_ERROR", "تعذر إنشاء الحساب");
  if (phone) {
    // upsertUser لا يكتب الهاتف؛ نحفظه في ملف المستخدم ليظهر للمركز.
    await database.update(users).set({ phone }).where(eq(users.id, user.id));
    user = { ...user, phone };
  }
  await database.insert(localCredentials).values({ userId: user.id, email, phone, phoneVerifiedAt: phone && input.phoneVerified ? new Date() : null, passwordHash: await hashPassword(input.password) });
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
    /** الدخول والتسجيل برقم الهاتف وكلمة المرور (بلا SMS). */
    phone: true,
    phoneCountryCode: ENV.phoneDefaultCountryCode,
    /** طريقة تحقق مفعّلة (واتساب أو SMS): التسجيل برقم الهاتف يتطلب إثبات الرقم، واستعادة كلمة المرور بالهاتف متاحة. */
    phoneVerification: isPhoneVerificationEnabled(),
    /** Twilio Verify مضبوط: رمز برسالة SMS. */
    smsVerification: isSmsConfigured(),
    /** WhatsApp Cloud API مضبوط: التحقق العكسي المجاني (المستخدم يرسل الرمز من واتساب). */
    whatsappVerification: isWhatsAppConfigured(),
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
            to: email,
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
    return { email: credential?.email ?? null, verified: Boolean(credential?.emailVerifiedAt), canSend: isEmailFlowReady() && Boolean(credential?.email) };
  }),

  resendVerification: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isEmailFlowReady()) throw fail("PRECONDITION_FAILED", "إرسال البريد غير مفعّل على هذا الخادم");
    const credential = await findCredentialByUserId(ctx.user.id);
    if (!credential?.email) throw fail("BAD_REQUEST", "لا يوجد بريد دخول لهذا الحساب");
    if (credential.emailVerifiedAt) return { success: true, alreadyVerified: true } as const;
    if (!(await hitRateLimit(`verify-send:${ctx.user.id}`, { max: 3, windowMs: 60 * 60 * 1000 }))) throw fail("TOO_MANY_REQUESTS", "أُرسلت عدة رسائل؛ حاول بعد ساعة");
    const sent = await sendVerificationEmail(ctx.user, credential.email);
    if (!sent) throw fail("INTERNAL_SERVER_ERROR", "تعذر إرسال الرسالة الآن؛ حاول لاحقاً");
    return { success: true, alreadyVerified: false } as const;
  }),

  /**
   * يبدأ التحقق العكسي عبر واتساب قبل التسجيل أو لاستعادة كلمة المرور. يعيد الرمز ورابط wa.me
   * وتذكرة سرية يستعلم بها المتصفح عن الحالة ثم يقدّمها لإكمال العملية.
   * للاستعادة: الرد واحد دائماً حتى لا يكشف أي الأرقام مسجّلة؛ التذكرة لا تفيد إلا لرقم مؤكد لحساب نشط.
   */
  startWhatsAppVerification: publicProcedure
    .input(z.object({ purpose: z.enum(["signup", "reset"]), phone: phoneInputSchema, inviteCode: z.string().trim().max(128).optional() }))
    .mutation(async ({ ctx, input }) => {
      requireWhatsApp();
      const phone = requirePhone(input.phone);
      if (input.purpose === "signup") {
        const invite = input.inviteCode ? classifyInviteCode(input.inviteCode) : null;
        if (input.inviteCode && !invite) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);
        if (!ENV.allowSignup && !invite) throw fail("FORBIDDEN", "إنشاء الحسابات مغلق إلا برمز دعوة؛ أدخل رمز الدعوة أو كود الدخول أولاً");
        if (invite && !(await isInviteUsable(invite))) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);
        if (await findCredentialByPhone(phone)) throw fail("CONFLICT", "يوجد حساب مسجّل برقم الهاتف هذا. سجّل الدخول بدلاً من ذلك");
      } else if (!(await consumeRateLimit(`reset:${clientKey(ctx)}`))) {
        throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      }
      await limitWhatsAppStart(ctx, phone);
      const start = await startWhatsAppVerification({ phone, purpose: input.purpose });
      await audit(null, "auth.whatsapp_verification_started", null, ctx, { scope: input.purpose });
      return publicStart(start, phone);
    }),

  /** حالة جلسة واتساب للمتصفح الذي بدأها (يستعلم كل ثانيتين). التذكرة سر عشوائي لا يمكن تخمينه. */
  whatsAppVerificationStatus: publicProcedure
    .input(z.object({ ticket: phoneTicketSchema }))
    .query(async ({ input }) => ({ status: await getWhatsAppVerificationStatus(input.ticket) })),

  /** يبدأ تأكيد رقم الدخول الحالي (verify) أو رقم جديد (add_phone، بكلمة المرور الحالية) عبر واتساب. */
  startMyWhatsAppVerification: protectedProcedure
    .input(z.object({ purpose: z.enum(["verify", "add_phone"]), phone: phoneInputSchema.optional(), currentPassword: passwordSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      requireWhatsApp();
      const credential = await findCredentialByUserId(ctx.user.id);
      let phone: string;
      if (input.purpose === "verify") {
        if (!credential?.phone) throw fail("BAD_REQUEST", "لا يوجد رقم هاتف للدخول في هذا الحساب");
        if (credential.phoneVerifiedAt) throw fail("BAD_REQUEST", "رقمك مؤكد مسبقاً");
        phone = credential.phone;
      } else {
        if (!credential) throw fail("BAD_REQUEST", "عيّن كلمة مرور أولاً");
        if (!input.currentPassword || !(await verifyPassword(input.currentPassword, credential.passwordHash))) throw fail("UNAUTHORIZED", "كلمة المرور الحالية غير صحيحة");
        if (!input.phone) throw fail("BAD_REQUEST", INVALID_PHONE_MESSAGE);
        phone = requirePhone(input.phone);
        await assertIdentityFree({ phone }, ctx.user.id);
      }
      await limitWhatsAppStart(ctx, phone, ctx.user.id);
      const start = await startWhatsAppVerification({ phone, purpose: input.purpose, userId: ctx.user.id });
      await audit(ctx.user.id, "auth.whatsapp_verification_started", ctx.user.id, ctx, { scope: input.purpose });
      return publicStart(start, phone);
    }),

  /** رمز SMS قبل إنشاء حساب برقم الهاتف. لا يُرسل إلا حين يكون التسجيل مسموحاً لهذا الشخص (عام أو برمز دعوة صالح). */
  requestSignupPhoneCode: publicProcedure
    .input(z.object({ phone: phoneInputSchema, inviteCode: z.string().trim().max(128).optional() }))
    .mutation(async ({ ctx, input }) => {
      requireSms();
      const phone = requirePhone(input.phone);
      const invite = input.inviteCode ? classifyInviteCode(input.inviteCode) : null;
      if (input.inviteCode && !invite) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);
      if (!ENV.allowSignup && !invite) throw fail("FORBIDDEN", "إنشاء الحسابات مغلق إلا برمز دعوة؛ أدخل رمز الدعوة أو كود الدخول أولاً");
      if (invite && !(await isInviteUsable(invite))) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);
      if (await findCredentialByPhone(phone)) throw fail("CONFLICT", "يوجد حساب مسجّل برقم الهاتف هذا. سجّل الدخول بدلاً من ذلك");
      await sendPhoneCode(ctx, phone, "signup");
      return { success: true, phone } as const;
    }),

  /** يرسل رمز استعادة إلى رقم الهاتف إن كان لحساب نشط. الرد واحد دائماً حتى لا يكشف أي الأرقام مسجّلة. */
  requestPhonePasswordReset: publicProcedure
    .input(z.object({ phone: phoneInputSchema }))
    .mutation(async ({ ctx, input }) => {
      requireSms();
      if (!(await consumeRateLimit(`reset:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      const phone = requirePhone(input.phone);
      const credential = await findCredentialByPhone(phone);
      // الاستعادة للأرقام المؤكدة فقط: رقم أُدخل دون تحقق قد يملكه شخص آخر فيستولي به على الحساب.
      if (!credential?.phoneVerifiedAt) return { success: true, phone } as const;
      const database = await requireDb();
      const user = (await database.select().from(users).where(eq(users.id, credential.userId)).limit(1))[0];
      if (!user || !isUserActive(user)) return { success: true, phone } as const;
      try {
        await sendPhoneCode(ctx, phone, "reset", user.id);
      } catch (error) {
        // حد المحاولات يظهر للمستخدم؛ أخطاء الرقم والخدمة لا تكشف وجود الحساب.
        if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") throw error;
        logger.warn({ err: error }, "[Auth] phone reset code failed");
      }
      return { success: true, phone } as const;
    }),

  /** يعيّن كلمة مرور جديدة برمز SMS أو بتذكرة واتساب مؤكدة، ويُخرج كل الأجهزة الأخرى ويدخل بهذا الجهاز. */
  resetPasswordWithPhone: publicProcedure
    .input(z.object({ phone: phoneInputSchema, code: phoneCodeSchema.optional(), ticket: phoneTicketSchema.optional(), newPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      requirePhoneVerification();
      if (!(await consumeRateLimit(`reset-check:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      assertPolicy(input.newPassword);
      const phone = requirePhone(input.phone);
      const credential = await findCredentialByPhone(phone);
      if (!credential?.phoneVerifiedAt) throw fail("BAD_REQUEST", INVALID_PHONE_CODE_MESSAGE);
      const database = await requireDb();
      const user = (await database.select().from(users).where(eq(users.id, credential.userId)).limit(1))[0];
      if (!user || !isUserActive(user)) throw fail("BAD_REQUEST", INVALID_PHONE_CODE_MESSAGE);
      await verifyPhoneProof(phone, { code: input.code, ticket: input.ticket }, "reset");
      await database.update(localCredentials).set({ passwordHash: await hashPassword(input.newPassword), failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date(), phoneVerifiedAt: new Date() }).where(eq(localCredentials.id, credential.id));
      await rotateSessions(ctx, user);
      await audit(user.id, "auth.password_reset_phone", user.id, ctx, { method: input.ticket ? "whatsapp" : "sms" });
      await linkChildrenSafely(user.id, phone);
      return { success: true } as const;
    }),

  register: publicProcedure
    .input(z.object({
      name: z.string().trim().min(2, "الاسم قصير جداً").max(120),
      /** بريد أو رقم هاتف أو كلاهما؛ يلزم واحد على الأقل. */
      email: emailSchema.optional(),
      phone: phoneInputSchema.optional(),
      password: passwordSchema,
      inviteCode: z.string().trim().max(128).optional(),
      /** رمز SMS المرسل بـ requestSignupPhoneCode (Twilio). */
      phoneCode: phoneCodeSchema.optional(),
      /** تذكرة واتساب من startWhatsAppVerification بعد تأكيدها. يلزم أحدهما حين يكون التحقق مفعّلاً. */
      phoneTicket: phoneTicketSchema.optional(),
    }).refine((input) => Boolean(input.email || input.phone), { message: "أدخل البريد الإلكتروني أو رقم الهاتف", path: ["email"] }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email ? normalizeEmail(input.email) : null;
      const phone = input.phone ? requirePhone(input.phone) : null;
      const invite = input.inviteCode ? classifyInviteCode(input.inviteCode) : null;
      if (input.inviteCode && !invite) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);
      if (!ENV.allowSignup && !invite) throw fail("FORBIDDEN", "إنشاء الحسابات مغلق إلا برمز دعوة؛ أدخل رمز الدعوة أو كود الدخول الذي وصلك من إدارة المركز");
      if (!(await consumeRateLimit(`register:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      assertPolicy(input.password);
      // لا نربط تلقائياً بحساب قديم يحمل البريد نفسه (مثل حساب أُنشئ بنظام الدخول السابق) لأن البريد غير مُتحقق منه؛
      // صاحب الحساب القديم يعيّن كلمة مروره من الإعدادات أو برابط من المدير.
      if (email && (await findCredentialByEmail(email))) throw fail("CONFLICT", "يوجد حساب مسجّل بهذا البريد. سجّل الدخول بدلاً من ذلك");
      if (phone && (await findCredentialByPhone(phone))) throw fail("CONFLICT", "يوجد حساب مسجّل برقم الهاتف هذا. سجّل الدخول بدلاً من ذلك");
      const database = await requireDb();
      const legacy = email ? await database.select({ id: users.id }).from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1) : [];
      if (legacy.length) throw fail("CONFLICT", "هذا البريد مرتبط بحساب موجود. سجّل الدخول بالطريقة السابقة وعيّن كلمة مرور من الإعدادات، أو اطلب من المدير رابط تعيين كلمة المرور.");
      if (invite && !(await isInviteUsable(invite))) throw fail("BAD_REQUEST", INVALID_INVITE_MESSAGE);
      const phoneVerified = Boolean(phone && isPhoneVerificationEnabled());
      if (phone && phoneVerified) await verifyPhoneProof(phone, { code: input.phoneCode, ticket: input.phoneTicket }, "signup");

      const user = await createLocalUser({ name: input.name, email, phone, phoneVerified, password: input.password });
      let granted: { role: string; centerId?: number } | null = null;
      if (invite) {
        try {
          granted = await redeemSignupInvite(invite, user.id, { ipAddress: clientKey(ctx), userAgent: String(ctx.req.headers?.["user-agent"] ?? "").slice(0, 512) || undefined });
        } catch (error) {
          // الرمز صار غير صالح بين الفحص والاسترداد: لا نترك حساباً بلا دعوة.
          await discardNewAccount(user.id).catch((discardError) => logger.warn({ err: discardError }, "[Auth] discard failed"));
          throw fail("BAD_REQUEST", error instanceof Error ? error.message : INVALID_INVITE_MESSAGE);
        }
      }
      // بعد الدعوة: إن منحت الدعوة دوراً آخر (معلم مثلاً) لا يُغيَّر إلى ولي أمر.
      const linkedChildren = phone && phoneVerified ? await linkChildrenSafely(user.id, phone) : 0;
      const fresh = (await database.select().from(users).where(eq(users.id, user.id)).limit(1))[0] ?? user;
      await issueSession(ctx, fresh);
      // تأكيد البريد لا يمنع الدخول؛ يُرسل في الخلفية إن كان البريد مفعّلاً.
      if (email) void sendVerificationEmail(fresh, email).catch((error) => logger.warn({ err: error }, "[Auth] verification email failed"));
      await audit(user.id, invite ? "auth.register_invite" : "auth.register", user.id, ctx, { method: phone && !email ? "phone" : "email", ...(phoneVerified ? { phoneProof: input.phoneTicket ? "whatsapp" : "sms" } : {}), ...(granted ? { inviteKind: invite!.kind, role: granted.role, centerId: granted.centerId } : {}) });
      return { success: true, role: granted?.role ?? (linkedChildren ? "guardian" : null), ...(linkedChildren ? { linkedChildren } : {}) } as const;
    }),

  login: publicProcedure
    .input(z.object({
      /** «البريد أو رقم الهاتف» من حقل واحد؛ email وphone يبقيان للعملاء القدامى والسكربتات. */
      identifier: identifierSchema.optional(),
      email: emailSchema.optional(),
      phone: phoneInputSchema.optional(),
      password: passwordSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await consumeRateLimit(`login:${clientKey(ctx)}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول بعد ربع ساعة");
      const identity = identityFromInput(input);
      if (!identity) throw fail("BAD_REQUEST", "أدخل البريد الإلكتروني أو رقم الهاتف");
      const credential = await findCredentialByIdentity(identity);
      const invalid = fail("UNAUTHORIZED", identity.email ? "البريد أو كلمة المرور غير صحيحة" : "رقم الهاتف أو كلمة المرور غير صحيحة");
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
      await audit(user.id, "auth.login", user.id, ctx, { method: identity.email ? "email" : "phone" });
      return { success: true } as const;
    }),

  /** حالة كلمة المرور للمستخدم الحالي (لصفحة الإعدادات). */
  myCredential: protectedProcedure.query(async ({ ctx }) => {
    const credential = await findCredentialByUserId(ctx.user.id);
    return {
      hasPassword: Boolean(credential),
      email: credential?.email ?? ctx.user.email ?? null,
      phone: credential?.phone ?? null,
      phoneVerified: Boolean(credential?.phoneVerifiedAt),
      /** Twilio مضبوط: يمكن تأكيد الرقم برمز SMS. */
      smsEnabled: isSmsConfigured(),
      /** WhatsApp Cloud API مضبوط: يمكن تأكيد الرقم برسالة واتساب يرسلها المستخدم. */
      whatsappEnabled: isWhatsAppConfigured(),
    };
  }),

  /** تعيين/تغيير كلمة المرور من داخل الجلسة — وهو أيضاً مسار المستخدمين القدامى لتعيين أول كلمة مرور. */
  setPassword: protectedProcedure
    .input(z.object({ identifier: identifierSchema.optional(), email: emailSchema.optional(), phone: phoneInputSchema.optional(), currentPassword: passwordSchema.optional(), newPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      assertPolicy(input.newPassword);
      const requested = identityFromInput(input);
      const existing = await findCredentialByUserId(ctx.user.id);
      if (existing) {
        if (!input.currentPassword || !(await verifyPassword(input.currentPassword, existing.passwordHash))) {
          throw fail("UNAUTHORIZED", "كلمة المرور الحالية غير صحيحة");
        }
      }
      const fallbackEmail = !existing && ctx.user.email ? normalizeEmail(ctx.user.email) : null;
      const saved = await saveCredential(ctx.user.id, requested ?? (fallbackEmail ? { email: fallbackEmail } : {}), input.newPassword);
      // تغيير كلمة المرور يُخرج كل الأجهزة الأخرى؛ الجهاز الحالي يبقى داخلاً بجلسة جديدة.
      await rotateSessions(ctx, ctx.user);
      await audit(ctx.user.id, existing ? "auth.password_changed" : "auth.password_set", ctx.user.id, ctx);
      return { success: true, email: saved.email, phone: saved.phone } as const;
    }),

  /** يضيف رقم هاتف للدخول (أو يغيّره) لحساب له كلمة مرور، بعد التحقق من كلمة المرور الحالية. */
  /** الخطوة الأولى لإضافة رقم مؤكد: يتحقق من كلمة المرور ثم يرسل رمز SMS إلى الرقم الجديد. */
  requestLoginPhoneCode: protectedProcedure
    .input(z.object({ phone: phoneInputSchema, currentPassword: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      requireSms();
      const credential = await findCredentialByUserId(ctx.user.id);
      if (!credential) throw fail("BAD_REQUEST", "عيّن كلمة مرور أولاً");
      if (!(await verifyPassword(input.currentPassword, credential.passwordHash))) throw fail("UNAUTHORIZED", "كلمة المرور الحالية غير صحيحة");
      const phone = requirePhone(input.phone);
      await assertIdentityFree({ phone }, ctx.user.id);
      await sendPhoneCode(ctx, phone, "add_phone", ctx.user.id);
      return { success: true, phone } as const;
    }),

  /** يرسل رمز SMS لتأكيد رقم الدخول الحالي غير المؤكد. */
  sendPhoneVerification: protectedProcedure.mutation(async ({ ctx }) => {
    requireSms();
    const credential = await findCredentialByUserId(ctx.user.id);
    if (!credential?.phone) throw fail("BAD_REQUEST", "لا يوجد رقم هاتف للدخول في هذا الحساب");
    if (credential.phoneVerifiedAt) return { success: true, alreadyVerified: true } as const;
    await sendPhoneCode(ctx, credential.phone, "verify", ctx.user.id);
    return { success: true, alreadyVerified: false } as const;
  }),

  /** يؤكد رقم الدخول الحالي برمز SMS أو بتذكرة واتساب مؤكدة، ثم يربط الأبناء المسجلين بهذا الرقم. */
  verifyPhone: protectedProcedure
    .input(z.object({ code: phoneCodeSchema.optional(), ticket: phoneTicketSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      requirePhoneVerification();
      const credential = await findCredentialByUserId(ctx.user.id);
      if (!credential?.phone) throw fail("BAD_REQUEST", "لا يوجد رقم هاتف للدخول في هذا الحساب");
      if (credential.phoneVerifiedAt) return { success: true } as const;
      await verifyPhoneProof(credential.phone, { code: input.code, ticket: input.ticket }, "verify", ctx.user.id);
      const database = await requireDb();
      await database.update(localCredentials).set({ phoneVerifiedAt: new Date() }).where(eq(localCredentials.id, credential.id));
      await audit(ctx.user.id, "auth.phone_verified", ctx.user.id, ctx, { method: input.ticket ? "whatsapp" : "sms" });
      const linkedChildren = await linkChildrenSafely(ctx.user.id, credential.phone);
      return { success: true, ...(linkedChildren ? { linkedChildren } : {}) } as const;
    }),

  setLoginPhone: protectedProcedure
    .input(z.object({ phone: phoneInputSchema, currentPassword: passwordSchema, code: phoneCodeSchema.optional(), ticket: phoneTicketSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await consumeRateLimit(`set-phone:${ctx.user.id}`))) throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      const credential = await findCredentialByUserId(ctx.user.id);
      if (!credential) throw fail("BAD_REQUEST", "عيّن كلمة مرور أولاً، ويمكنك حينها الدخول برقم الهاتف مباشرة");
      if (!(await verifyPassword(input.currentPassword, credential.passwordHash))) throw fail("UNAUTHORIZED", "كلمة المرور الحالية غير صحيحة");
      const phone = requirePhone(input.phone);
      await assertIdentityFree({ phone }, ctx.user.id);
      // مع التحقق المفعّل لا يُحفظ رقم دون إثبات امتلاكه، حتى لا يحجز أحد رقم غيره.
      const verificationOn = isPhoneVerificationEnabled();
      if (verificationOn) await verifyPhoneProof(phone, { code: input.code, ticket: input.ticket }, "add_phone", ctx.user.id);
      const database = await requireDb();
      await database.update(localCredentials).set({ phone, phoneVerifiedAt: verificationOn ? new Date() : null }).where(eq(localCredentials.id, credential.id));
      await database.update(users).set({ phone }).where(eq(users.id, ctx.user.id));
      await audit(ctx.user.id, credential.phone ? "auth.login_phone_changed" : "auth.login_phone_added", ctx.user.id, ctx);
      const linkedChildren = verificationOn ? await linkChildrenSafely(ctx.user.id, phone) : 0;
      return { success: true, phone, ...(linkedChildren ? { linkedChildren } : {}) } as const;
    }),

  /** الخروج من كل الأجهزة: يبطل كل الجلسات بما فيها الحالية. */
  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    await db.bumpSessionVersion(ctx.user.id);
    ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
    await audit(ctx.user.id, "auth.logout_all", ctx.user.id, ctx);
    return { success: true } as const;
  }),

  /**
   * رابط تعيين كلمة مرور لمستخدم (صالح 72 ساعة ولمرة واحدة): من صلاحية المدير العام.
   * في نسخة الجهاز (دون SMS أو بريد) يصدره أيضاً مالك المركز لعضو في مركزه ليفتحه على الجهاز نفسه.
   */
  createSetupLink: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = ADMIN_ROLES.has(ctx.user.role);
      if (!isAdmin && !(isSqliteDialect() && (await ownsCenterOf(ctx.user.id, input.userId)))) throw fail("FORBIDDEN", "إنشاء روابط كلمة المرور من صلاحية المدير العام");
      const database = await requireDb();
      const target = (await database.select().from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target || target.deletedAt) throw fail("NOT_FOUND", "المستخدم غير موجود");
      if (!isAdmin && ADMIN_ROLES.has(target.role)) throw fail("FORBIDDEN", "لا يمكن تعيين كلمة مرور المدير العام");
      const link = await createPasswordSetupToken(target.id, ctx.user.id);
      await audit(ctx.user.id, "auth.setup_link_created", target.id, ctx);
      return link;
    }),

  completeSetup: publicProcedure
    .input(z.object({ token: z.string().trim().min(20).max(200), identifier: identifierSchema.optional(), email: emailSchema.optional(), phone: phoneInputSchema.optional(), password: passwordSchema }))
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
      // المعرّف الموجود يبقى؛ المعرّف المدخل يُستخدم فقط لحساب بلا كلمة مرور بعد.
      const requested = existing ? null : identityFromInput(input);
      const identity: LoginIdentity = requested ?? (existing ? {} : user.email ? { email: normalizeEmail(user.email) } : {});
      if (!existing && !identity.email && !identity.phone) throw fail("BAD_REQUEST", "أدخل البريد أو رقم الهاتف الذي ستستخدمه للدخول");
      await assertIdentityFree(identity, user.id);
      // نعلّم الرابط مستخدماً أولاً (حماية من الاستخدام المزدوج المتزامن).
      const marked = await database.update(passwordSetupTokens).set({ usedAt: new Date() }).where(and(eq(passwordSetupTokens.id, row.id), isNull(passwordSetupTokens.usedAt)));
      const affected = (marked as unknown as [{ affectedRows?: number }])[0]?.affectedRows;
      if (affected === 0) throw fail("BAD_REQUEST", "الرابط مستخدم من قبل");
      const saved = await saveCredential(user.id, identity, input.password);
      // رابط الاستعادة وصل إلى هذا البريد، فهو مؤكد.
      if (row.purpose === "reset") await database.update(localCredentials).set({ emailVerifiedAt: new Date() }).where(eq(localCredentials.userId, user.id));
      await rotateSessions(ctx, user);
      await audit(user.id, row.purpose === "reset" ? "auth.password_reset_completed" : "auth.setup_completed", user.id, ctx);
      return { success: true, email: saved.email, phone: saved.phone } as const;
    }),
};
