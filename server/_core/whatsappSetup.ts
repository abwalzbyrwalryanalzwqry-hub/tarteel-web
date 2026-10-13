/**
 * فحص إعداد واتساب من الخادم نفسه، وربط حساب واتساب للأعمال (WABA) بالتطبيق.
 * يستخدمه scripts/whatsapp-setup.ts؛ منفصل ليُختبر دون شبكة.
 *
 * الخطوة التي يُغفلها أغلب الناس: بعد «Verify and save» في لوحة Meta لا تصل الرسائل حتى
 * يُشترك التطبيق في WABA عبر POST /{WABA_ID}/subscribed_apps، ولا تُظهر اللوحة هذا الاشتراك.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-whatsapp
 */
import { createHmac, randomBytes } from "node:crypto";
import { normalizePhone } from "../../shared/phone";
import { WHATSAPP_WEBHOOK_PATH } from "./whatsapp";

export const GRAPH_API = "https://graph.facebook.com/v23.0";

export type CheckResult = { ok: boolean; label: string; detail?: string };
type Fetch = typeof fetch;

const pass = (label: string, detail?: string): CheckResult => ({
  ok: true,
  label,
  detail,
});
const fail = (label: string, detail: string): CheckResult => ({
  ok: false,
  label,
  detail,
});

export const generateVerifyToken = () => randomBytes(24).toString("base64url");

/** يفحص متغيرات البيئة ويشرح المفقود بالعربية. */
export function checkEnv(env: NodeJS.ProcessEnv): CheckResult[] {
  const results: CheckResult[] = [];
  const number = normalizePhone(
    env.WHATSAPP_BUSINESS_NUMBER?.trim() ?? "",
    "0"
  );
  results.push(
    number
      ? pass("WHATSAPP_BUSINESS_NUMBER", number)
      : fail(
          "WHATSAPP_BUSINESS_NUMBER",
          "مفقود أو ليس بصيغة دولية (مثل +967771234567)"
        )
  );
  const secret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  results.push(
    /^[0-9a-f]{32}$/i.test(secret)
      ? pass("WHATSAPP_APP_SECRET")
      : secret.length >= 16
        ? pass(
            "WHATSAPP_APP_SECRET",
            "مضبوط، لكنه ليس 32 خانة ست عشرية كما يظهر في Meta؛ تأكد أنه App Secret لا رمز الوصول"
          )
        : fail(
            "WHATSAPP_APP_SECRET",
            "مفقود: App settings ← Basic ← App secret ← Show"
          )
  );
  const token = env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  results.push(
    token.length >= 8
      ? pass("WHATSAPP_VERIFY_TOKEN")
      : fail(
          "WHATSAPP_VERIFY_TOKEN",
          "مفقود أو أقصر من 8 أحرف؛ ولّد واحداً: node dist/whatsapp-setup.js token"
        )
  );
  const base = (env.PUBLIC_APP_URL ?? "").trim();
  results.push(
    /^https:\/\/[^/]+/.test(base) && !/example\.(org|com)/.test(base)
      ? pass(
          "PUBLIC_APP_URL",
          `${base.replace(/\/+$/, "")}${WHATSAPP_WEBHOOK_PATH}`
        )
      : fail(
          "PUBLIC_APP_URL",
          "يجب أن يكون نطاقك الحقيقي بـ https (Meta ترفض http والشهادات الموقعة ذاتياً)"
        )
  );
  return results;
}

/** يجرّب Webhook كما تفعل Meta: مصافحة GET، ورسالة موقعة، ورسالة بلا توقيع يجب رفضها. */
export async function checkWebhook(
  baseUrl: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: Fetch = fetch
): Promise<CheckResult[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}${WHATSAPP_WEBHOOK_PATH}`;
  const token = env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  const secret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const results: CheckResult[] = [];
  const challenge = `tarteel-${randomBytes(4).toString("hex")}`;
  try {
    const response = await fetchImpl(
      `${url}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=${challenge}`
    );
    const body = await response.text();
    results.push(
      response.status === 200 && body === challenge
        ? pass("مصافحة Webhook (GET)", url)
        : fail(
            "مصافحة Webhook (GET)",
            response.status === 403
              ? "403: رمز التحقق لا يطابق WHATSAPP_VERIFY_TOKEN على الخادم، أو أن واتساب غير مفعّل (أعد تشغيل الحاوية بعد تعديل .env)"
              : `الحالة ${response.status}؛ تأكد أن الخادم يعمل بالإصدار الذي فيه واتساب وأن Caddy يمرر /api`
          )
    );
  } catch (error) {
    results.push(
      fail(
        "مصافحة Webhook (GET)",
        `تعذر الوصول إلى ${url}: ${(error as Error).message}`
      )
    );
    return results;
  }
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [],
  });
  const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const post = (headers: Record<string, string>) =>
    fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: payload,
    });
  const signed = await post({ "X-Hub-Signature-256": signature });
  results.push(
    signed.status === 200
      ? pass("رسالة موقعة (POST)")
      : fail(
          "رسالة موقعة (POST)",
          signed.status === 401
            ? "401: التوقيع لا يطابق WHATSAPP_APP_SECRET على الخادم"
            : `الحالة ${signed.status}`
        )
  );
  const unsigned = await post({});
  results.push(
    unsigned.status === 401
      ? pass("رفض رسالة بلا توقيع")
      : fail(
          "رفض رسالة بلا توقيع",
          `الحالة ${unsigned.status} بدل 401؛ وكيل أمام الخادم قد يغيّر الطلب`
        )
  );
  return results;
}

async function graph(
  path: string,
  accessToken: string,
  fetchImpl: Fetch,
  init: RequestInit = {}
) {
  const response = await fetchImpl(`${GRAPH_API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  > & { error?: { message?: string; code?: number } };
  return { ok: response.ok, data };
}

/** فحوص Graph API (تحتاج WHATSAPP_ACCESS_TOKEN): الرقم يطابق، وحالته، واشتراك التطبيق في WABA. */
export async function checkGraph(
  env: NodeJS.ProcessEnv,
  fetchImpl: Fetch = fetch
): Promise<CheckResult[]> {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  if (!accessToken)
    return [
      fail(
        "Graph API",
        "WHATSAPP_ACCESS_TOKEN غير مضبوط؛ تُتخطى فحوص الرقم والاشتراك (التحقق يعمل بدونه، لكن لا يمكن التأكد من اشتراك WABA)"
      ),
    ];
  const results: CheckResult[] = [];
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  if (phoneNumberId) {
    const { ok, data } = await graph(
      `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,status`,
      accessToken,
      fetchImpl
    );
    if (!ok) {
      results.push(
        fail(
          "رقم الأعمال",
          data.error?.message ?? "تعذرت قراءة WHATSAPP_PHONE_NUMBER_ID"
        )
      );
    } else {
      const display = normalizePhone(
        String(data.display_phone_number ?? ""),
        "0"
      );
      const expected = normalizePhone(
        env.WHATSAPP_BUSINESS_NUMBER?.trim() ?? "",
        "0"
      );
      results.push(
        display && display === expected
          ? pass(
              "رقم الأعمال",
              `${display} — ${data.verified_name ?? ""} (الجودة: ${data.quality_rating ?? "؟"}، المنصة: ${data.platform_type ?? "؟"})`
            )
          : fail(
              "رقم الأعمال",
              `رقم Meta ${display ?? data.display_phone_number} لا يطابق WHATSAPP_BUSINESS_NUMBER ${expected ?? "(فارغ)"}؛ سيرسل المستخدمون إلى رقم خاطئ`
            )
      );
      if (data.platform_type && data.platform_type !== "CLOUD_API")
        results.push(
          fail(
            "تسجيل الرقم في Cloud API",
            `المنصة ${String(data.platform_type)}؛ سجّل الرقم: POST /${phoneNumberId}/register مع pin من 6 أرقام`
          )
        );
    }
  } else {
    results.push(
      fail(
        "WHATSAPP_PHONE_NUMBER_ID",
        "غير مضبوط؛ تجده في WhatsApp ← API Setup (Phone number ID)"
      )
    );
  }
  const wabaId = env.WHATSAPP_WABA_ID?.trim() ?? "";
  if (!wabaId) {
    results.push(
      fail(
        "WHATSAPP_WABA_ID",
        "غير مضبوط؛ تجده في WhatsApp ← API Setup (WhatsApp Business Account ID). لازم لفحص الاشتراك"
      )
    );
    return results;
  }
  const { ok, data } = await graph(
    `${wabaId}/subscribed_apps`,
    accessToken,
    fetchImpl
  );
  const apps = (
    (data.data as Array<{
      whatsapp_business_api_data?: { id?: string; name?: string };
    }>) ?? []
  ).map(app => app.whatsapp_business_api_data ?? {});
  const appId = env.WHATSAPP_APP_ID?.trim();
  const subscribed = appId
    ? apps.some(app => app.id === appId)
    : apps.length > 0;
  results.push(
    !ok
      ? fail(
          "اشتراك التطبيق في WABA",
          data.error?.message ?? "تعذرت قراءة subscribed_apps"
        )
      : subscribed
        ? pass(
            "اشتراك التطبيق في WABA",
            apps.map(app => `${app.name ?? "?"} (${app.id ?? "?"})`).join("، ")
          )
        : fail(
            "اشتراك التطبيق في WABA",
            apps.length
              ? `المشتركون: ${apps.map(app => app.name ?? app.id).join("، ")} — ليس تطبيقك. شغّل: node dist/whatsapp-setup.js subscribe`
              : "لا تطبيق مشترك، فلن تصل الرسائل. شغّل: node dist/whatsapp-setup.js subscribe"
          )
  );
  return results;
}

/** يشترك التطبيق (صاحب رمز الوصول) في WABA ليصله حقل messages. */
export async function subscribeApp(
  env: NodeJS.ProcessEnv,
  fetchImpl: Fetch = fetch
): Promise<CheckResult> {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const wabaId = env.WHATSAPP_WABA_ID?.trim() ?? "";
  if (!accessToken || !wabaId)
    return fail(
      "الاشتراك",
      "يلزم WHATSAPP_ACCESS_TOKEN و WHATSAPP_WABA_ID في .env"
    );
  const { ok, data } = await graph(
    `${wabaId}/subscribed_apps`,
    accessToken,
    fetchImpl,
    { method: "POST" }
  );
  return ok && data.success !== false
    ? pass("الاشتراك", `اشترك التطبيق في WABA ${wabaId}`)
    : fail(
        "الاشتراك",
        data.error?.message ??
          "رفضت Meta الطلب؛ يحتاج الرمز صلاحية whatsapp_business_management على هذا WABA"
      );
}
