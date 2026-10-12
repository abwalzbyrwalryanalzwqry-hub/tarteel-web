/**
 * تخزين الملفات في ترتيل — ثلاثة محركات يختارها STORAGE_DRIVER:
 *   local (الافتراضي خارج Manus): قرص الخادم في STORAGE_DIR.
 *   s3    : أي خدمة متوافقة مع S3 (AWS S3, Cloudflare R2, Backblaze B2, MinIO).
 *   manus : Forge Storage (السلوك القديم).
 *
 * الروابط العامة تبقى بالصيغة /manus-storage/{key} عمداً، حتى تعمل كل الروابط
 * المحفوظة في قاعدة البيانات وملفات المصحف والخطوط بلا أي ترحيل للبيانات.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ENV, hasForge } from "./_core/env";

export const STORAGE_URL_PREFIX = "/manus-storage/";

export type StorageDriver = "local" | "s3" | "manus";

export function getStorageDriver(): StorageDriver {
  const explicit = ENV.storageDriver;
  if (explicit === "local" || explicit === "s3" || explicit === "manus") return explicit;
  if (ENV.s3Bucket) return "s3";
  if (hasForge()) return "manus";
  return "local";
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

// ── Forge (Manus) ──
function getForgeConfig() {
  if (!hasForge()) throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  return { forgeUrl: ENV.forgeApiUrl.replace(/\/+$/, ""), forgeKey: ENV.forgeApiKey };
}

async function forgePresign(kind: "put" | "get", key: string) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const url = new URL(`v1/storage/presign/${kind}`, forgeUrl + "/");
  url.searchParams.set("path", key);
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage presign ${kind} failed (${resp.status}): ${msg}`);
  }
  const { url: signed } = (await resp.json()) as { url: string };
  if (!signed) throw new Error("Forge returned empty presign URL");
  return signed;
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
  } else if (driver === "s3") {
    await getS3().send(new PutObjectCommand({ Bucket: ENV.s3Bucket, Key: key, Body: body, ContentType: contentType }));
  } else {
    const s3Url = await forgePresign("put", key);
    const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: new Blob([body], { type: contentType }) });
    if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `${STORAGE_URL_PREFIX}${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `${STORAGE_URL_PREFIX}${key}` };
}

/** رابط مباشر مؤقت (S3/Manus) أو null في التخزين المحلي (استخدم storageRead). */
export async function storageGetSignedUrl(relKey: string): Promise<string | null> {
  const key = normalizeKey(relKey);
  const driver = getStorageDriver();
  if (driver === "s3") return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }), { expiresIn: 600 });
  if (driver === "manus") return forgePresign("get", key);
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
