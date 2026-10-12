const str = (value: string | undefined, fallback = "") => (value ?? fallback).trim();
const bool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

/**
 * AUTH_PROVIDER:
 * - "local"  (الافتراضي خارج Manus) دخول بالبريد وكلمة المرور داخل ترتيل، بلا أي خدمة خارجية.
 * - "hybrid" (الافتراضي على Manus) دخول محلي + زر Manus OAuth، لمرحلة الانتقال.
 * - "manus"  السلوك القديم (Manus OAuth فقط).
 */
// بلا AUTH_PROVIDER: على Manus (OAUTH_SERVER_URL موجود) نعمل hybrid حتى لا يُحجب أحد عن الدخول
// قبل أن يعيّن كلمة مرور؛ وخارج Manus نعمل local.
const rawAuthProvider = str(process.env.AUTH_PROVIDER, process.env.OAUTH_SERVER_URL ? "hybrid" : "local").toLowerCase();
const authProvider = (["local", "hybrid", "manus"].includes(rawAuthProvider) ? rawAuthProvider : "local") as
  | "local"
  | "hybrid"
  | "manus";

export const ENV = {
  appId: str(process.env.VITE_APP_ID, "tarteel") || "tarteel",
  cookieSecret: str(process.env.JWT_SECRET),
  databaseUrl: str(process.env.DATABASE_URL),
  isProduction: process.env.NODE_ENV === "production",

  // ── المصادقة ──
  authProvider,
  /** صاحب المنصة: يُمنح دور admin عند إنشاء حسابه المحلي بهذا البريد. */
  ownerEmail: str(process.env.OWNER_EMAIL).toLowerCase(),
  /** السماح بإنشاء حسابات جديدة من صفحة الدخول (الدور يبقى user حتى استرداد كود وصول). */
  allowSignup: bool(process.env.ALLOW_SIGNUP, true),

  // ── Manus (اختياري، للانتقال فقط) ──
  oAuthServerUrl: str(process.env.OAUTH_SERVER_URL),
  ownerOpenId: str(process.env.OWNER_OPEN_ID),
  forgeApiUrl: str(process.env.BUILT_IN_FORGE_API_URL),
  forgeApiKey: str(process.env.BUILT_IN_FORGE_API_KEY),

  // ── الذكاء الاصطناعي: أي خدمة متوافقة مع OpenAI (OpenAI, OpenRouter, Groq, Ollama...) ──
  llmApiUrl: str(process.env.LLM_API_URL),
  llmApiKey: str(process.env.LLM_API_KEY),
  llmModel: str(process.env.LLM_MODEL),

  // ── التخزين: local (قرص الخادم) أو s3 (S3/R2/MinIO) أو manus ──
  storageDriver: str(process.env.STORAGE_DRIVER).toLowerCase(),
  storageDir: str(process.env.STORAGE_DIR, "./data/uploads"),
  s3Bucket: str(process.env.S3_BUCKET),
  s3Region: str(process.env.S3_REGION, "auto"),
  s3Endpoint: str(process.env.S3_ENDPOINT),
  s3AccessKeyId: str(process.env.S3_ACCESS_KEY_ID),
  s3SecretAccessKey: str(process.env.S3_SECRET_ACCESS_KEY),

  // ── إشعارات المالك: Webhook عام (Telegram/Slack/Discord عبر وسيط) ──
  ownerWebhookUrl: str(process.env.OWNER_NOTIFY_WEBHOOK_URL),
};

export const isManusOAuthEnabled = () =>
  (ENV.authProvider === "manus" || ENV.authProvider === "hybrid") && Boolean(ENV.oAuthServerUrl);

export const isLocalAuthEnabled = () => ENV.authProvider === "local" || ENV.authProvider === "hybrid";

export const hasForge = () => Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
