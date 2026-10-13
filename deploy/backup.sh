#!/usr/bin/env bash
# نسخ احتياطي لترتيل: قاعدة البيانات (mysqldump) + الملفات المرفوعة، مع حذف النسخ القديمة،
# ورفع اختياري إلى تخزين خارجي متوافق مع S3 (Cloudflare R2 / Backblaze B2 / ...).
#
#   ./deploy/backup.sh                 من مجلد المشروع على الخادم
#   crontab: 30 2 * * * cd /opt/tarteel-web && ./deploy/backup.sh >> /var/log/tarteel-backup.log 2>&1
#
# المتغيرات (من البيئة أو .env):
#   BACKUP_DIR=./backups   BACKUP_KEEP_DAYS=14
#   BACKUP_S3_BUCKET / BACKUP_S3_ENDPOINT / BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY / BACKUP_S3_REGION / BACKUP_S3_PREFIX
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

DB_FILE="$BACKUP_DIR/tarteel-db-$STAMP.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/tarteel-uploads-$STAMP.tar.gz"

echo "[$STAMP] قاعدة البيانات ← $DB_FILE"
# --single-transaction: لقطة متسقة دون قفل الجداول (InnoDB). كلمة المرور تُمرر داخل الحاوية عبر MYSQL_PWD.
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF --databases tarteel' | gzip -9 > "$DB_FILE.part"
# ملف ناقص (فشل mysqldump) لا يحل محل نسخة صالحة.
gzip -t "$DB_FILE.part"
zcat "$DB_FILE.part" | tail -n 1 | grep -q "Dump completed" || { echo "mysqldump لم يكتمل" >&2; rm -f "$DB_FILE.part"; exit 1; }
mv "$DB_FILE.part" "$DB_FILE"

echo "[$STAMP] الملفات المرفوعة ← $UPLOADS_FILE"
docker compose exec -T app tar -C /data/uploads -czf - . > "$UPLOADS_FILE.part"
gzip -t "$UPLOADS_FILE.part"
mv "$UPLOADS_FILE.part" "$UPLOADS_FILE"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  for file in "$DB_FILE" "$UPLOADS_FILE"; do
    echo "[$STAMP] رفع $(basename "$file") إلى $BACKUP_S3_BUCKET"
    docker compose exec -T app node dist/backup-upload.js "$(basename "$file")" < "$file"
  done
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'tarteel-*.gz' -mtime "+$KEEP_DAYS" -print -delete
echo "[$STAMP] اكتمل النسخ الاحتياطي"
