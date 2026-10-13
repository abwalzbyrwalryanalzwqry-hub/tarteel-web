/**
 * النسخ الاحتياطي في نسخة الجهاز: ملف SQLite واحد فيه كل بيانات الجهاز
 * (الحسابات والمراكز والحلقات والطلاب والسجلات والشعارات).
 * التصدير يمر بجسر أندرويد فيظهر خيار الحفظ أو المشاركة (الملفات، Drive، واتساب...).
 */
import {
  exportLocalDatabase,
  initLocalDatabase,
  inspectLocalBackup,
  rawLocalQuery,
  replaceLocalDatabase,
  saveLocalDatabaseNow,
  type LocalBackupInfo,
} from "./database";
import { clearLocalSession } from "./context";

export type { LocalBackupInfo };

const ADMIN_ROLES = new Set(["super_admin", "org_admin", "admin"]);

/** النسخة تحوي بيانات كل الحسابات، فيصدّرها ويستعيدها مالك مركز أو مدير المنصة فقط. */
export async function canManageLocalBackup(userId: number) {
  await initLocalDatabase();
  const [user] = rawLocalQuery("SELECT role FROM users WHERE id = ?", [userId]);
  if (user && ADMIN_ROLES.has(String(user[0]))) return true;
  const owner = rawLocalQuery(
    "SELECT 1 FROM center_memberships WHERE userId = ? AND isOwner = 1 AND revokedAt IS NULL AND status = 'active' LIMIT 1",
    [userId]
  );
  return owner.length > 0;
}

/** جهاز جديد بلا حسابات: تُعرض استعادة النسخة في صفحة الدخول. */
export async function localDeviceHasAccounts() {
  await initLocalDatabase();
  return Number(rawLocalQuery("SELECT count(*) FROM users")[0]?.[0] ?? 0) > 0;
}

function stamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export async function downloadLocalBackup() {
  await saveLocalDatabaseNow();
  const bytes = exportLocalDatabase();
  const filename = `tarteel-backup-${stamp()}.sqlite`;
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/x-sqlite3" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { filename, size: bytes.length };
}

export async function readBackupFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await inspectLocalBackup(bytes);
  return { bytes, info };
}

/** يستبدل بيانات الجهاز بالنسخة، ويُخرج الجميع، ثم يعيد فتح التطبيق على صفحة الدخول. */
export async function restoreLocalBackup(bytes: Uint8Array) {
  await replaceLocalDatabase(bytes);
  clearLocalSession();
  window.location.replace("/login?restored=1");
}
