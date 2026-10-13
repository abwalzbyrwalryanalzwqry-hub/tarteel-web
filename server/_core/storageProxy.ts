import type { Express } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStorageDriver, resolveLocalPath, storageGetSignedUrl } from "../storage";

const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * يخدم /storage/{key}:
 *  1. من القرص المحلي STORAGE_DIR إن وُجد الملف (أصول المصحف والخطوط + الرفوعات المحلية).
 *  2. وإلا (محرك s3) تحويل 307 إلى رابط موقّع مؤقت.
 * أسماء الملفات تحمل بصمة (hash) فيمكن تخزينها مؤقتاً لمدة طويلة.
 */
export function registerStorageProxy(app: Express) {
  // Express 5: المحرف البديل يجب أن يُسمّى، ويعيد مقاطع المسار مصفوفة.
  app.get("/storage/*key", async (req, res) => {
    const segments = req.params.key;
    const key = Array.isArray(segments) ? segments.join("/") : segments;
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

      const url = getStorageDriver() === "s3" ? await storageGetSignedUrl(key) : null;
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
