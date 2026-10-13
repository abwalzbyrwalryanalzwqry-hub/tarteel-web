/**
 * جلسات التحقق العكسي عبر واتساب (انظر server/_core/whatsapp.ts).
 *
 * 1. startWhatsAppVerification: ينشئ جلسة لرقم وغرض محددين، ويعيد للمتصفح الرمز ورابط wa.me
 *    وتذكرة سرية (لا تُعرض في الرسالة). الجلسة صالحة 10 دقائق.
 * 2. handleInboundWhatsAppMessage: يستدعيه Webhook لكل رسالة واردة. إن طابق الرمز جلسة لرقم
 *    المرسل نفسه صارت verified (وتمدَّد 15 دقيقة لإكمال النموذج). إن وصل الرمز من رقم آخر
 *    صارت mismatch حتى لا يؤكد أحد رقماً لا يملكه.
 * 3. consumeWhatsAppVerification: يقدّم المتصفح التذكرة مع الرقم والغرض لإكمال العملية مرة واحدة.
 */
import { and, eq, gt, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { phoneVerifications } from "../../drizzle/schema";
import {
  buildVerificationMessage,
  buildWhatsAppLink,
  extractVerificationCode,
  generateVerificationCode,
  getWhatsAppConfig,
  type VerificationPurpose,
} from "../_core/whatsapp";
import { getDb } from "../data/connection";
import { hitRateLimit } from "../data/usage-limits";
import { normalizePhone } from "../../shared/phone";

export const WHATSAPP_SESSION_TTL_MS = 10 * 60 * 1000;
export const WHATSAPP_VERIFIED_TTL_MS = 15 * 60 * 1000;

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db;
}

export type WhatsAppVerificationStart = {
  ticket: string;
  code: string;
  message: string;
  link: string;
  businessNumber: string;
  expiresAt: Date;
};

export async function startWhatsAppVerification(input: {
  phone: string;
  purpose: VerificationPurpose;
  userId?: number | null;
  now?: Date;
}): Promise<WhatsAppVerificationStart> {
  const config = getWhatsAppConfig();
  if (!config) throw new Error("whatsapp_not_configured");
  const db = await requireDb();
  const now = input.now ?? new Date();
  const code = generateVerificationCode();
  const ticket = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + WHATSAPP_SESSION_TTL_MS);
  await db.insert(phoneVerifications).values({
    purpose: input.purpose,
    phone: input.phone,
    userId: input.userId ?? null,
    codeHash: sha256(code),
    ticketHash: sha256(ticket),
    expiresAt,
  });
  const message = buildVerificationMessage(code, input.purpose);
  return {
    ticket,
    code,
    message,
    link: buildWhatsAppLink(config.businessNumber, message),
    businessNumber: `+${config.businessNumber}`,
    expiresAt,
  };
}

export type WhatsAppVerificationStatus =
  "pending" | "verified" | "mismatch" | "expired";

export async function getWhatsAppVerificationStatus(
  ticket: string,
  now = new Date()
): Promise<WhatsAppVerificationStatus> {
  const db = await requireDb();
  const row = (
    await db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.ticketHash, sha256(ticket)))
      .limit(1)
  )[0];
  if (!row || row.status === "consumed" || row.expiresAt <= now)
    return "expired";
  return row.status;
}

export type InboundResult = "verified" | "mismatch" | "ignored";

/** يعالج رسالة واردة واحدة. `from` كما يرسله واتساب: أرقام دون +. */
export async function handleInboundWhatsAppMessage(
  from: string,
  text: string,
  now = new Date()
): Promise<InboundResult> {
  const sender = normalizePhone(`+${from.replace(/\D/g, "")}`);
  const code = extractVerificationCode(text);
  if (!sender || !code) return "ignored";
  // رسائل عشوائية كثيرة من رقم واحد لا تستهلك قاعدة البيانات.
  if (
    !(await hitRateLimit(`wa-inbound:${sender}`, {
      max: 20,
      windowMs: 60 * 60 * 1000,
    }))
  )
    return "ignored";
  const db = await requireDb();
  const rows = await db
    .select()
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.codeHash, sha256(code)),
        eq(phoneVerifications.status, "pending"),
        gt(phoneVerifications.expiresAt, now)
      )
    );
  if (!rows.length) return "ignored";
  const match = rows.find(row => row.phone === sender);
  if (match) {
    await db
      .update(phoneVerifications)
      .set({
        status: "verified",
        verifiedAt: now,
        expiresAt: new Date(now.getTime() + WHATSAPP_VERIFIED_TTL_MS),
      })
      .where(
        and(
          eq(phoneVerifications.id, match.id),
          eq(phoneVerifications.status, "pending")
        )
      );
    return "verified";
  }
  // الرمز صحيح لكنه أُرسل من رقم غير المطلوب (مثل واتساب الأعمال بدل الشخصي على الجهاز نفسه).
  await db
    .update(phoneVerifications)
    .set({ status: "mismatch" })
    .where(
      inArray(
        phoneVerifications.id,
        rows.map(row => row.id)
      )
    );
  return "mismatch";
}

/**
 * يستهلك تذكرة مؤكدة مرة واحدة إن طابقت الرقم والغرض (والحساب عند التأكيد من داخل الحساب).
 * يعيد false لأي تذكرة غير صالحة دون تمييز السبب.
 */
export async function consumeWhatsAppVerification(input: {
  ticket: string;
  phone: string;
  purpose: VerificationPurpose;
  userId?: number | null;
  now?: Date;
}): Promise<boolean> {
  const db = await requireDb();
  const now = input.now ?? new Date();
  const row = (
    await db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.ticketHash, sha256(input.ticket)))
      .limit(1)
  )[0];
  if (
    !row ||
    row.status !== "verified" ||
    row.expiresAt <= now ||
    row.phone !== input.phone ||
    row.purpose !== input.purpose ||
    (input.userId != null && row.userId !== input.userId)
  )
    return false;
  const result = await db
    .update(phoneVerifications)
    .set({ status: "consumed", consumedAt: now })
    .where(
      and(
        eq(phoneVerifications.id, row.id),
        eq(phoneVerifications.status, "verified")
      )
    );
  const affected = (result as unknown as [{ affectedRows?: number }])[0]
    ?.affectedRows;
  return affected !== 0;
}
