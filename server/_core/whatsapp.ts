/**
 * التحقق العكسي من رقم الهاتف عبر واتساب (WhatsApp Cloud API من Meta، بلا مكتبة).
 *
 * الفكرة: لا يرسل ترتيل أي رسالة. يعرض للمستخدم رمزاً قصيراً ورابط wa.me برسالة جاهزة،
 * فيرسلها المستخدم من واتساب رقمه إلى رقم المركز، وتصل إلى الخادم عبر Webhook ومعها رقم
 * المرسل كما يعرفه واتساب. الرسائل الواردة لا تكلّف شيئاً في تسعير Meta، فالتحقق مجاني.
 *
 *   WHATSAPP_BUSINESS_NUMBER=+967…   رقم واتساب المسجل في Cloud API (يظهر في رابط wa.me)
 *   WHATSAPP_APP_SECRET=…            App Secret لتطبيق Meta (للتحقق من توقيع X-Hub-Signature-256)
 *   WHATSAPP_VERIFY_TOKEN=…          نص سري تختاره وتكتبه في إعداد Webhook لدى Meta
 *   اختياري: WHATSAPP_ACCESS_TOKEN و WHATSAPP_PHONE_NUMBER_ID لإرسال رد تأكيد قصير للمرسل
 *   (ردود الخدمة مجانية حتى 1000 رسالة شهرياً لكل رقم؛ بدونها لا يُرسل شيء والواجهة تكفي).
 *
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { normalizePhone, toLatinDigits } from "../../shared/phone";
import { logger } from "./logger";

export type WhatsAppConfig = {
  /** رقم الأعمال بأرقام فقط دون + (كما يطلبه wa.me). */
  businessNumber: string;
  appSecret: string;
  verifyToken: string;
  reply: { accessToken: string; phoneNumberId: string } | null;
};

export function getWhatsAppConfig(
  env: NodeJS.ProcessEnv = process.env
): WhatsAppConfig | null {
  const number = normalizePhone(
    env.WHATSAPP_BUSINESS_NUMBER?.trim() ?? "",
    "0"
  );
  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  if (!number || appSecret.length < 16 || verifyToken.length < 8) return null;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  return {
    businessNumber: number.slice(1),
    appSecret,
    verifyToken,
    reply:
      accessToken && /^\d{5,30}$/.test(phoneNumberId)
        ? { accessToken, phoneNumberId }
        : null,
  };
}

export const isWhatsAppConfigured = () => getWhatsAppConfig() !== null;

/** حروف وأرقام لا تلتبس عند القراءة (بلا 0 O 1 I L U). 30^8 ≈ 6.5×10^11 احتمالاً. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_PATTERN = new RegExp(
  `(?:^|[^A-Z0-9])([${CODE_ALPHABET}]{4})[-\\s]?([${CODE_ALPHABET}]{4})(?![A-Z0-9])`
);

/** رمز مثل 7KQ2-M9XD. */
export function generateVerificationCode() {
  let raw = "";
  for (let i = 0; i < 8; i += 1)
    raw += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** يستخرج الرمز من نص الرسالة الواردة بصيغته الموحدة، أو null. */
export function extractVerificationCode(text: string): string | null {
  const match = CODE_PATTERN.exec(toLatinDigits(text).toUpperCase());
  return match ? `${match[1]}-${match[2]}` : null;
}

export type VerificationPurpose = "signup" | "reset" | "verify" | "add_phone";

const PURPOSE_TEXT: Record<VerificationPurpose, string> = {
  signup: "لإنشاء حسابي",
  reset: "لاستعادة كلمة مروري",
  verify: "لتأكيد رقمي",
  add_phone: "لإضافة رقمي إلى حسابي",
};

/**
 * نص الرسالة الجاهزة. الغرض مكتوب صراحة حتى لا يُخدع أحد فيرسل رمز استعادة لغيره.
 */
export function buildVerificationMessage(
  code: string,
  purpose: VerificationPurpose
) {
  return `ترتيل: أؤكد أن هذا رقمي ${PURPOSE_TEXT[purpose]}. رمز التحقق: ${code}`;
}

export function buildWhatsAppLink(businessNumber: string, message: string) {
  return `https://wa.me/${businessNumber}?text=${encodeURIComponent(message)}`;
}

/** يتحقق من ترويسة X-Hub-Signature-256 على جسم الطلب الخام. */
export function isValidWebhookSignature(
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string
) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type InboundTextMessage = { id: string; from: string; text: string };

/** الرسائل النصية الواردة من جسم Webhook (يتجاهل حالات التسليم وأنواع الرسائل الأخرى). */
export function extractInboundTextMessages(
  payload: unknown
): InboundTextMessage[] {
  const out: InboundTextMessage[] = [];
  const body = payload as {
    object?: string;
    entry?: {
      changes?: {
        field?: string;
        value?: {
          messages?: {
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
          }[];
        };
      }[];
    }[];
  };
  if (body?.object !== "whatsapp_business_account") return out;
  for (const entry of body.entry ?? [])
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const message of change.value?.messages ?? []) {
        if (message.type !== "text" || !message.from || !message.text?.body)
          continue;
        out.push({
          id: String(message.id ?? ""),
          from: message.from,
          text: message.text.body.slice(0, 1000),
        });
      }
    }
  return out;
}

/** رد اختياري قصير داخل نافذة خدمة العملاء؛ أي فشل يُسجَّل فقط ولا يؤثر في التحقق. */
export async function sendWhatsAppReply(
  config: WhatsAppConfig,
  to: string,
  text: string,
  fetchImpl: typeof fetch = fetch
) {
  if (!config.reply) return;
  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/v23.0/${config.reply.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.reply.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!response.ok)
      logger.warn(
        { status: response.status },
        "[WhatsApp] reply rejected by Cloud API"
      );
  } catch (error) {
    logger.warn({ err: error }, "[WhatsApp] reply failed");
  }
}
