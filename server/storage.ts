/**
 * تخزين الملفات في ترتيل — محركان يختارهما STORAGE_DRIVER:
 *   local (الافتراضي): قرص الخادم في STORAGE_DIR.
 *   s3   : أي خدمة متوافقة مع S3 (AWS S3, Cloudflare R2, Backblaze B2, MinIO).
 *
 * الروابط العامة بالصيغة /storage/{key}.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

export const STORAGE_URL_PREFIX = "/storage/";

export type StorageDriver = "local" | "s3";

export function getStorageDriver(): StorageDriver {
  const explicit = ENV.storageDriver;
  if (explicit === "local" || explicit === "s3") return explicit;
  return ENV.s3Bucket ? "s3" : "local";
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/** يمنع الخروج من مجلد التخزين (../) ويعيد مساراً مطلقاً آمناً أو null. */
export function resolveLocalPath(key: string): string | null {
  const root = path.resolve(ENV.storageDir);
  const clean = normalizeKey(decodeURIComponent(key));
  if (!clean || clean.includes("\0")) return null;
  const full = path.resolve(root, clean);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

const toBuffer = (data: Buffer | Uint8Array | string) => (typeof data === "string" ? Buffer.from(data) : Buffer.from(data));

// ── S3 ──
let s3Client: S3Client | null = null;
function getS3() {
  if (!ENV.s3Bucket) throw new Error("S3_BUCKET is not configured");
  s3Client ??= new S3Client({
    region: ENV.s3Region || "auto",
    endpoint: ENV.s3Endpoint || undefined,
    forcePathStyle: Boolean(ENV.s3Endpoint),
    credentials: ENV.s3AccessKeyId ? { accessKeyId: ENV.s3AccessKeyId, secretAccessKey: ENV.s3SecretAccessKey } : undefined,
  });
  return s3Client;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const driver = getStorageDriver();
  const body = toBuffer(data);

  if (driver === "local") {
    const full = resolveLocalPath(key);
    if (!full) throw new Error("Invalid storage key");
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  } else {
    await getS3().send(new PutObjectCommand({ Bucket: ENV.s3Bucket, Key: key, Body: body, ContentType: contentType }));
  }

  return { key, url: `${STORAGE_URL_PREFIX}${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `${STORAGE_URL_PREFIX}${key}` };
}

/** رابط مباشر مؤقت (S3) أو null في التخزين المحلي (استخدم storageRead). */
export async function storageGetSignedUrl(relKey: string): Promise<string | null> {
  const key = normalizeKey(relKey);
  const driver = getStorageDriver();
  if (driver === "s3") return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }), { expiresIn: 600 });
  return null;
}

/** قراءة محتوى ملف أياً كان المحرك (تُستخدم لإدراج الشعار في تقارير PDF). */
export async function storageRead(relKey: string): Promise<Buffer | undefined> {
  const key = normalizeKey(relKey);
  if (getStorageDriver() === "local") {
    const full = resolveLocalPath(key);
    if (!full) return undefined;
    return fs.readFile(full).catch(() => undefined);
  }
  const url = await storageGetSignedUrl(key);
  if (!url) return undefined;
  const response = await fetch(url);
  return response.ok ? Buffer.from(await response.arrayBuffer()) : undefined;
}
