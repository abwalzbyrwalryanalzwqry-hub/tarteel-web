/**
 * يرفع نسخة احتياطية من stdin إلى تخزين متوافق مع S3 (R2/B2/AWS/MinIO). يستدعيه deploy/backup.sh داخل حاوية التطبيق:
 *   docker compose exec -T app node dist/backup-upload.js tarteel-db-….sql.gz < file
 *
 * BACKUP_S3_BUCKET (إلزامي) / BACKUP_S3_ENDPOINT / BACKUP_S3_REGION (auto) / BACKUP_S3_PREFIX (tarteel-backups/)
 * BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY
 * استخدم مفتاحاً منفصلاً عن مفتاح الرفوعات وبصلاحية كتابة فقط إن أمكن، وقاعدة انتهاء (lifecycle) في الحاوية لحذف القديم.
 */
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const name = process.argv[2];
const bucket = process.env.BACKUP_S3_BUCKET;
if (!name || !/^[\w.-]+$/.test(name) || !bucket) {
  console.error("الاستخدام: node dist/backup-upload.js <اسم-الملف> < الملف   (مع BACKUP_S3_BUCKET)");
  process.exit(2);
}
const prefix = (process.env.BACKUP_S3_PREFIX ?? "tarteel-backups/").replace(/^\/+/, "");
const client = new S3Client({
  region: process.env.BACKUP_S3_REGION || "auto",
  endpoint: process.env.BACKUP_S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(process.env.BACKUP_S3_ENDPOINT),
  credentials: process.env.BACKUP_S3_ACCESS_KEY_ID
    ? { accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY ?? "" }
    : undefined,
});
const key = `${prefix}${name}`;
// PutObject يحتاج طولاً معروفاً؛ نحفظ stdin في ملف مؤقت أولاً (حد PutObject الواحد 5GB).
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tarteel-backup-"));
const tmp = path.join(dir, name);
try {
  await pipeline(process.stdin, createWriteStream(tmp, { mode: 0o600 }));
  const { size } = await fs.stat(tmp);
  if (size === 0) throw new Error("الملف فارغ");
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: createReadStream(tmp), ContentLength: size, ContentType: "application/gzip" }));
  console.log(`[backup] رُفع ${key} (${(size / 1048576).toFixed(1)} MB)`);
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
