/**
 * بديل server/storage.ts: الملفات (شعارات المراكز) تُحفظ داخل قاعدة SQLite المحلية،
 * والرابط المعاد data: URL يعرضه المتصفح مباشرة دون خادم.
 */
import { Buffer } from "buffer";
import { rawLocalQuery, rawLocalRun } from "../database";

export const STORAGE_URL_PREFIX = "/storage/";
export type StorageDriver = "local" | "s3";

export function getStorageDriver(): StorageDriver {
  return "local";
}

const normalizeKey = (relKey: string) => relKey.replace(/^\/+/, "");

function appendHashSuffix(key: string) {
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), b =>
    b.toString(16).padStart(2, "0")
  ).join("");
  const dot = key.lastIndexOf(".");
  return dot > key.lastIndexOf("/")
    ? `${key.slice(0, dot)}_${suffix}${key.slice(dot)}`
    : `${key}_${suffix}`;
}

const toBuffer = (data: Uint8Array | string) =>
  typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
const dataUrl = (contentType: string, bytes: Uint8Array) =>
  `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;

export function resolveLocalPath(_key: string): string | null {
  return null;
}

export async function storagePut(
  relKey: string,
  data: Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = toBuffer(data);
  rawLocalRun(
    "INSERT OR REPLACE INTO __tarteel_files (fileKey, contentType, data, createdAt) VALUES (?, ?, ?, ?)",
    [key, contentType, new Uint8Array(body), Date.now()]
  );
  return { key, url: dataUrl(contentType, body) };
}

function readFile(key: string) {
  const row = rawLocalQuery(
    "SELECT contentType, data FROM __tarteel_files WHERE fileKey = ?",
    [key]
  )[0];
  if (!row) return null;
  return { contentType: String(row[0]), bytes: row[1] as Uint8Array };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const file = readFile(key);
  return { key, url: file ? dataUrl(file.contentType, file.bytes) : "" };
}

export async function storageGetSignedUrl(
  relKey: string
): Promise<string | null> {
  return (await storageGet(relKey)).url || null;
}

export async function storageRead(relKey: string): Promise<Buffer | undefined> {
  const file = readFile(normalizeKey(relKey));
  return file ? Buffer.from(file.bytes) : undefined;
}
