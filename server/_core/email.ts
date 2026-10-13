/**
 * إرسال البريد التشغيلي (تأكيد البريد، استعادة كلمة المرور) عبر Resend أو Brevo.
 *
 *   EMAIL_PROVIDER=resend|brevo   (اختياري؛ يُستنتج من المفتاح المضبوط)
 *   RESEND_API_KEY=re_…           أو   BREVO_API_KEY=xkeysib-…
 *   EMAIL_FROM=no-reply@example.com
 *   EMAIL_FROM_NAME=ترتيل          (اختياري)
 *
 * بلا مفتاح: البريد معطّل، وتختفي «نسيت كلمة المرور» من الواجهة ويبقى رابط المدير هو البديل.
 * Resend: https://resend.com/docs/api-reference/emails/send-email
 * Brevo:  https://developers.brevo.com/reference/sendtransacemail
 */

import { logger } from "./logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};
type Provider = "resend" | "brevo";

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env) {
  const resendKey = env.RESEND_API_KEY?.trim() ?? "";
  const brevoKey = env.BREVO_API_KEY?.trim() ?? "";
  const requested = env.EMAIL_PROVIDER?.trim().toLowerCase();
  const provider: Provider | null =
    requested === "resend"
      ? resendKey
        ? "resend"
        : null
      : requested === "brevo"
        ? brevoKey
          ? "brevo"
          : null
        : resendKey
          ? "resend"
          : brevoKey
            ? "brevo"
            : null;
  const from = env.EMAIL_FROM?.trim() ?? "";
  const fromName = env.EMAIL_FROM_NAME?.trim() || "ترتيل";
  return {
    provider: from ? provider : null,
    apiKey: provider === "resend" ? resendKey : brevoKey,
    from,
    fromName,
  };
}

export const isEmailConfigured = () => getEmailConfig().provider !== null;

const TIMEOUT_MS = 10_000;

/** يرسل الرسالة؛ يعيد true عند القبول. لا يرمي: فشل البريد لا يجب أن يكشف وجود الحساب أو يسقط الطلب. */
export async function sendEmail(
  message: EmailMessage,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const config = getEmailConfig();
  if (!config.provider) {
    logger.warn(
      { subject: message.subject },
      "[Email] not configured; message dropped"
    );
    return false;
  }
  const request: {
    url: string;
    headers: Record<string, string>;
    body: unknown;
  } =
    config.provider === "resend"
      ? {
          url: "https://api.resend.com/emails",
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: {
            from: `${config.fromName} <${config.from}>`,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          },
        }
      : {
          url: "https://api.brevo.com/v3/smtp/email",
          headers: { "api-key": config.apiKey },
          body: {
            sender: { email: config.from, name: config.fromName },
            to: [{ email: message.to }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
          },
        };
  try {
    const response = await fetchImpl(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...request.headers,
      },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.error(
        {
          provider: config.provider,
          status: response.status,
          body: (await response.text().catch(() => "")).slice(0, 300),
        },
        "[Email] provider rejected message"
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.error(
      { err: error, provider: config.provider },
      "[Email] send failed"
    );
    return false;
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    ch =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!
  );

/** قالب بسيط باتجاه RTL يعمل في عملاء البريد (جداول وأنماط مضمنة). */
export function actionEmail(input: {
  to: string;
  subject: string;
  greeting: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
}): EmailMessage {
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#faf7f0;font-family:Tahoma,Arial,sans-serif;color:#3b3325">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px;text-align:right" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:bold;color:#b8862f;padding-bottom:16px">ترتيل</td></tr>
<tr><td style="font-size:15px;line-height:1.9">${escapeHtml(input.greeting)}<br>${escapeHtml(input.body)}</td></tr>
<tr><td style="padding:24px 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#b8862f;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:bold">${escapeHtml(input.actionLabel)}</a></td></tr>
<tr><td style="font-size:12px;line-height:1.8;color:#7a6f5c">${escapeHtml(input.footer)}<br><span dir="ltr" style="word-break:break-all">${escapeHtml(input.actionUrl)}</span></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${input.greeting}\n${input.body}\n\n${input.actionLabel}: ${input.actionUrl}\n\n${input.footer}`;
  return { to: input.to, subject: input.subject, html, text };
}
