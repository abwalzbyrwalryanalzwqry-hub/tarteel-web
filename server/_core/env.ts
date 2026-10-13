const str = (value: string | undefined, fallback = "") => (value ?? fallback).trim();
const bool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};
const int = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const ENV = {
  appId: str(process.env.APP_ID, "tarteel") || "tarteel",
  cookieSecret: str(process.env.JWT_SECRET),
  databaseUrl: str(process.env.DATABASE_URL),
  isProduction: process.env.NODE_ENV === "production",

  // ── المصادقة: بريد وكلمة مرور داخل ترتيل ──
  /**
   * السماح بإنشاء حسابات جديدة من صفحة الدخول (الدور يبقى user حتى استرداد كود وصول).
   * مغلق افتراضياً: الخادم المنشور دون ضبط هذا المتغير لا يقبل حسابات من أي زائر.
   */
  allowSignup: bool(process.env.ALLOW_SIGNUP, false),
  /** رمز الدولة للأرقام المكتوبة محلياً عند التسجيل والدخول برقم الهاتف (اليمن 967 افتراضياً). */
  phoneDefaultCountryCode: str(process.env.PHONE_DEFAULT_COUNTRY_CODE, "967").replace(/\D/g, "") || "967",
  /** عدد الوكلاء العكسيين (Caddy/Nginx/Render) أمام الخادم؛ يحدد كيف يُقرأ IP العميل الحقيقي. */
  trustProxyHops: int(process.env.TRUST_PROXY_HOPS, 1),
  /** الحد اليومي لرسائل المساعد الذكي لكل مستخدم (0 = تعطيل المساعد). */
  aiDailyLimit: int(process.env.AI_DAILY_LIMIT, 30),

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

  /**
   * العنوان العام للمنصة (مثل https://tarteel.example.com). يلزم لروابط البريد ولـ Google:
   * لا نبني الروابط من ترويسة Host لأن المهاجم يتحكم بها (تسميم رابط استعادة كلمة المرور).
   */
  publicAppUrl: str(process.env.PUBLIC_APP_URL).replace(/\/+$/, ""),

  // ── الدخول بـ Google (اختياري) ──
  googleClientId: str(process.env.GOOGLE_CLIENT_ID),
  googleClientSecret: str(process.env.GOOGLE_CLIENT_SECRET),

  // ── إشعارات المالك: Webhook عام (Telegram/Slack/Discord عبر وسيط) ──
  ownerWebhookUrl: str(process.env.OWNER_NOTIFY_WEBHOOK_URL),
};
