/**
 * بيئة تشغيل منطق الخادم داخل المتصفح/WebView (النسخة المحلية).
 * يجب أن يُستورد قبل أي وحدة من server/ لأنها تقرأ process.env وBuffer عند تحميلها.
 */
import { Buffer } from "buffer";

const SECRET_KEY = "tarteel.local.jwtSecret";

function deviceSecret() {
  try {
    const existing = localStorage.getItem(SECRET_KEY);
    if (existing && existing.length >= 32) return existing;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(SECRET_KEY, secret);
    return secret;
  } catch {
    // دون localStorage تبقى الجلسة صالحة حتى إغلاق التطبيق فقط.
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

// حزمة buffer لا تدعم base64url التي يستخدمها الخادم في الرموز العشوائية.
const proto = Buffer.prototype as unknown as { toString: (encoding?: string, start?: number, end?: number) => string };
const originalToString = proto.toString;
proto.toString = function toString(this: Buffer, encoding?: string, start?: number, end?: number) {
  if (encoding === "base64url") return originalToString.call(this, "base64", start, end).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return originalToString.call(this, encoding, start, end);
};

type GlobalShim = typeof globalThis & { Buffer?: typeof Buffer; __TARTEEL_LOCAL__?: boolean; __TARTEEL_ENV__?: Record<string, string> };
const g = globalThis as GlobalShim;
g.Buffer ??= Buffer;
g.__TARTEEL_LOCAL__ = true;
// vite.config.ts يستبدل process.env في نسخة الجهاز بهذا الكائن.
g.__TARTEEL_ENV__ = {
  NODE_ENV: "production",
  APP_ID: "tarteel",
  JWT_SECRET: deviceSecret(),
  // كل من يستخدم الجهاز ينشئ حسابه؛ المدير ينشئ مركزه ويمنح الأدوار برموز الوصول كما في المنصة.
  ALLOW_SIGNUP: "1",
  LOG_LEVEL: "warn",
  AI_DAILY_LIMIT: "0",
};
(g as { process?: unknown }).process = {
  env: g.__TARTEEL_ENV__,
  cwd: () => "/",
  platform: "android",
  version: "v22.0.0",
  nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => fn(...args)),
};

export const LOCAL_MODE = true;
