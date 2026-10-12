import type { Express } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ENV, hasForge } from "./env";
import { getStorageDriver, resolveLocalPath, storageGetSignedUrl } from "../storage";

const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * يخدم /manus-storage/{key}:
 *  1. من القرص المحلي STORAGE_DIR إن وُجد الملف (أصول المصحف والخطوط المنسوخة + الرفوعات المحلية).
 *  2. وإلا تحويل 307 إلى رابط موقّع من S3 أو Manus حسب المحرك المضبوط.
 * أسماء الملفات تحمل بصمة (hash) فيمكن تخزينها مؤقتاً لمدة طويلة.
 */
export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    const localPath = resolveLocalPath(key);
    if (!localPath) {
      res.status(400).send("Invalid storage key");
      return;
    }

    try {
      const stat = await fs.stat(localPath).catch(() => null);
      if (stat?.isFile()) {
        res.set("Cache-Control", IMMUTABLE);
        res.set("X-Content-Type-Options", "nosniff");
        // SVG قد يحمل سكربت؛ نمنع تنفيذه عند فتحه مباشرة.
        if (path.extname(localPath).toLowerCase() === ".svg") res.set("Content-Security-Policy", "script-src 'none'");
        res.sendFile(localPath);
        return;
      }

      const driver = getStorageDriver();
      if (driver === "local") {
        // أثناء الانتقال: إن بقيت بيانات Forge مضبوطة نجلب منها ما لم يُنسخ بعد.
        if (!hasForge()) {
          res.status(404).send("Not found");
          return;
        }
      }

      const url = driver === "local" ? await forgeFallback(key) : await storageGetSignedUrl(key);
      if (!url) {
        res.status(404).send("Not found");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

async function forgeFallback(key: string) {
  const url = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
  url.searchParams.set("path", key);
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
  if (!resp.ok) return null;
  const { url: signed } = (await resp.json()) as { url?: string };
  return signed ?? null;
}

