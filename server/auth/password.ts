import { hitRateLimit, resetUsageLimitsMemoryForTests } from "../data/usage-limits";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

// معاملات scrypt الموصى بها من OWASP (N=2^15, r=8, p=1) — لا تحتاج أي مكتبة خارجية.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** يعيد رسالة خطأ عربية أو null إن كانت كلمة المرور مقبولة. */
export function getPasswordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل.`;
  if (password.length > PASSWORD_MAX_LENGTH) return "كلمة المرور طويلة جداً.";
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/\d/.test(password)) return "كلمة المرور يجب أن تحتوي على حروف وأرقام.";
  return null;
}

/** الصيغة: scrypt$N$r$p$salt(base64)$hash(base64) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** تجزئة ثابتة نستخدمها عند عدم وجود الحساب، حتى لا يكشف زمن الاستجابة وجود البريد. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex") + "1a");
  return dummyHash;
}

export function createSetupToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSetupToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

// ── حد المحاولات لكل IP فوق القفل الدائم لكل حساب؛ يُحفظ في MySQL (انظر data/usage-limits) ──
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_PER_WINDOW = 20;

export function consumeRateLimit(key: string, now = Date.now()): Promise<boolean> {
  return hitRateLimit(key, { max: RATE_LIMIT_MAX_PER_WINDOW, windowMs: RATE_LIMIT_WINDOW_MS, now });
}

export function resetRateLimitsForTests() {
  resetUsageLimitsMemoryForTests();
}

export const MAX_FAILED_ATTEMPTS = 8;
export const LOCK_DURATION_MS = 15 * 60 * 1000;
