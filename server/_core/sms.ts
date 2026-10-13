/**
 * التحقق من رقم الهاتف برسالة SMS عبر Twilio Verify (بلا مكتبة twilio؛ طلبا REST فقط).
 *
 *   TWILIO_ACCOUNT_SID=AC…
 *   TWILIO_AUTH_TOKEN=…               أو مفتاح API منفصل (موصى به في الإنتاج):
 *   TWILIO_API_KEY_SID=SK…  و  TWILIO_API_KEY_SECRET=…
 *   TWILIO_VERIFY_SERVICE_SID=VA…     (Console ← Verify ← Services)
 *
 * Twilio يولّد الرمز ويرسله ويتحقق منه، ويحذف التحقق بعد قبوله أو بعد 10 دقائق أو بعد
 * تجاوز عدد المحاولات (فيعيد VerificationCheck الخطأ 404). الرمز لا يمر بخادم ترتيل ولا يُخزن فيه.
 * بلا هذه المتغيرات: التحقق معطّل ويبقى الرقم معرّف دخول غير مؤكد كما كان.
 *
 * https://www.twilio.com/docs/verify/api/verification
 * https://www.twilio.com/docs/verify/api/verification-check
 */

import { toLatinDigits } from "../../shared/phone";

export type SmsConfig = {
  accountSid: string;
  username: string;
  password: string;
  serviceSid: string;
};

export function getSmsConfig(
  env: NodeJS.ProcessEnv = process.env
): SmsConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const apiKeySid = env.TWILIO_API_KEY_SID?.trim() ?? "";
  const apiKeySecret = env.TWILIO_API_KEY_SECRET?.trim() ?? "";
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim() ?? "";
  if (
    !/^AC[0-9a-f]{32}$/i.test(accountSid) ||
    !/^VA[0-9a-f]{32}$/i.test(serviceSid)
  )
    return null;
  if (apiKeySid && apiKeySecret)
    return {
      accountSid,
      username: apiKeySid,
      password: apiKeySecret,
      serviceSid,
    };
  if (authToken)
    return {
      accountSid,
      username: accountSid,
      password: authToken,
      serviceSid,
    };
  return null;
}

export const isSmsConfigured = () => getSmsConfig() !== null;

/** سبب فشل يمكن عرضه للمستخدم بالعربية؛ الأخطاء الأخرى تُسجَّل وتظهر رسالة عامة. */
export type SmsFailure =
  "invalid_number" | "too_many" | "blocked" | "unavailable";

export class SmsError extends Error {
  constructor(
    readonly reason: SmsFailure,
    readonly twilioCode?: number
  ) {
    super(`sms_${reason}${twilioCode ? `_${twilioCode}` : ""}`);
  }
}

export const SMS_FAILURE_MESSAGES: Record<SmsFailure, string> = {
  invalid_number:
    "تعذر إرسال الرسالة إلى هذا الرقم؛ تأكد أنه رقم جوال صحيح مع رمز الدولة",
  too_many: "أُرسلت رموز كثيرة إلى هذا الرقم؛ انتظر 10 دقائق ثم حاول مجدداً",
  blocked:
    "إرسال الرسائل إلى هذه الدولة غير متاح حالياً؛ تواصل مع إدارة المركز",
  unavailable: "تعذر إرسال رسالة التحقق الآن؛ حاول بعد قليل",
};

/** رموز أخطاء Twilio الشائعة: https://www.twilio.com/docs/api/errors */
function classifyTwilioError(code: number | undefined): SmsFailure {
  if (code === 60200 || code === 21211 || code === 21614 || code === 60205)
    return "invalid_number";
  if (code === 60203 || code === 60202 || code === 20429) return "too_many";
  if (code === 60410 || code === 60605 || code === 60220 || code === 21408)
    return "blocked";
  return "unavailable";
}

const TIMEOUT_MS = 10_000;

async function twilioPost(
  config: SmsConfig,
  path: "Verifications" | "VerificationCheck",
  form: Record<string, string>,
  fetchImpl: typeof fetch
) {
  const url = `https://verify.twilio.com/v2/Services/${config.serviceSid}/${path}`;
  const auth = Buffer.from(`${config.username}:${config.password}`).toString(
    "base64"
  );
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: string;
    code?: number;
    message?: string;
  };
  return { ok: response.ok, httpStatus: response.status, body };
}

/** يرسل رمز تحقق إلى الرقم (بصيغة E.164). يرمي SmsError عند الفشل. */
export async function startPhoneVerification(
  phone: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const config = getSmsConfig();
  if (!config) throw new SmsError("unavailable");
  let result: Awaited<ReturnType<typeof twilioPost>>;
  try {
    result = await twilioPost(
      config,
      "Verifications",
      { To: phone, Channel: "sms", Locale: "ar" },
      fetchImpl
    );
  } catch (error) {
    console.warn("[SMS] Twilio request failed", String(error));
    throw new SmsError("unavailable");
  }
  if (!result.ok) {
    const reason = classifyTwilioError(result.body.code);
    if (reason === "unavailable")
      console.warn(
        "[SMS] Twilio rejected verification",
        result.httpStatus,
        result.body.code,
        result.body.message
      );
    throw new SmsError(reason, result.body.code);
  }
}

/**
 * يتحقق من الرمز. يعيد true فقط إن قبله Twilio (status=approved).
 * الرمز الخاطئ أو المنتهي أو المستخدم من قبل (404) يعيد false؛ عطل الخدمة يرمي SmsError.
 */
export async function checkPhoneVerification(
  phone: string,
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const config = getSmsConfig();
  if (!config) throw new SmsError("unavailable");
  const cleaned = toLatinDigits(code).replace(/\s/g, "");
  if (!/^\d{4,10}$/.test(cleaned)) return false;
  let result: Awaited<ReturnType<typeof twilioPost>>;
  try {
    result = await twilioPost(
      config,
      "VerificationCheck",
      { To: phone, Code: cleaned },
      fetchImpl
    );
  } catch (error) {
    console.warn("[SMS] Twilio check failed", String(error));
    throw new SmsError("unavailable");
  }
  if (result.httpStatus === 404) return false;
  if (!result.ok) {
    const reason = classifyTwilioError(result.body.code);
    if (reason === "too_many") return false;
    console.warn(
      "[SMS] Twilio rejected check",
      result.httpStatus,
      result.body.code,
      result.body.message
    );
    throw new SmsError(reason, result.body.code);
  }
  return result.body.status === "approved";
}
