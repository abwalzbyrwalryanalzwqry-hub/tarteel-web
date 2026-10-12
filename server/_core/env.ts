const str = (value: string | undefined, fallback = "") => (value ?? fallback).trim();
const bool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

export const ENV = {
  appId: str(process.env.APP_ID, "tarteel") || "tarteel",
  cookieSecret: str(process.env.JWT_SECRET),
  databaseUrl: str(process.env.DATABASE_URL),
  isProduction: process.env.NODE_ENV === "production",

  // ── المصادقة: بريد وكلمة مرور داخل ترتيل ──
  /** صاحب المنصة: يُمنح دور admin عند إنشاء حسابه بهذا البريد. */
  ownerEmail: str(process.env.OWNER_EMAIL).toLowerCase(),
  /** السماح بإنشاء حسابات جديدة من صفحة الدخول (الدور يبقى user حتى استرداد كود وصول). */
  allowSignup: bool(process.env.ALLOW_SIGNUP, true),

  // ── الذكاء الاصطناعي: أي خدمة متوافقة مع OpenAI (OpenAI, OpenRouter, Groq, Ollama...) ──
  llmApiUrl: str(process.env.LLM_API_URL),
  llmApiKey: str(process.env.LLM_API_KEY),
  llmModel: str(process.env.LLM_MODEL),

  // ── التخزين: local (قرص الخادم) أو s3 (S3/R2/MinIO) ──
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
