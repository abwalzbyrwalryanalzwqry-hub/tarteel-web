import { AlertTriangle, DatabaseBackup, Download, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  canManageLocalBackup,
  downloadLocalBackup,
  readBackupFile,
  restoreLocalBackup,
  type LocalBackupInfo,
} from "@/local/backup";

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} ك.ب`
    : `${(bytes / 1024 / 1024).toFixed(1)} م.ب`;

/** استيراد نسخة: يعرض محتواها ويطلب تأكيداً لأنه يستبدل بيانات الجهاز كلها. */
export function RestoreBackupPanel({ compact = false }: { compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<{
    name: string;
    bytes: Uint8Array;
    info: LocalBackupInfo;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { bytes, info } = await readBackupFile(file);
      setCandidate({ name: file.name, bytes, info });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر قراءة الملف");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!candidate) return;
    setBusy(true);
    try {
      await restoreLocalBackup(candidate.bytes);
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "تعذرت الاستعادة");
    }
  };

  return (
    <div className={compact ? "space-y-3" : "mt-4 space-y-3"}>
      <input
        ref={input}
        type="file"
        className="hidden"
        onChange={pick}
        aria-label="ملف النسخة الاحتياطية"
        data-testid="backup-file-input"
      />
      {!candidate ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {busy ? "جارٍ فحص الملف…" : "استعادة من نسخة احتياطية"}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-7">
          <p className="flex items-start gap-2 font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle
              className="mt-1 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            ستحل هذه النسخة محل كل بيانات الجهاز الحالية، ويخرج الجميع ليدخلوا
            بحساباتهم في النسخة.
          </p>
          <ul className="ms-5 list-disc text-foreground">
            <li>الملف: {candidate.name}</li>
            <li>الحسابات: {candidate.info.users}</li>
            <li>المراكز: {candidate.info.centers}</li>
            <li>الحلقات: {candidate.info.circles}</li>
            <li>الطلاب: {candidate.info.students}</li>
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={restore}
              className="btn-gold min-h-11 flex-1 px-4 py-2 text-sm"
            >
              {busy ? "جارٍ الاستعادة…" : "استبدال البيانات بهذه النسخة"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCandidate(null)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** بطاقة الإعدادات في نسخة الجهاز: تصدير نسخة احتياطية واستعادتها. */
export default function DeviceBackupCard() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(() => {
    try {
      return localStorage.getItem("tarteel.local.lastBackup");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user) return;
    void canManageLocalBackup(user.id).then(setAllowed, () =>
      setAllowed(false)
    );
  }, [user]);

  const backup = async () => {
    setBusy(true);
    try {
      const { filename, size } = await downloadLocalBackup();
      const when = new Date().toLocaleString("ar", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      setLast(when);
      try {
        localStorage.setItem("tarteel.local.lastBackup", when);
      } catch {
        // اختياري
      }
      toast.success(`جُهّزت النسخة (${sizeLabel(size)}): ${filename}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء النسخة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="glass-card rounded-2xl p-5"
      data-testid="device-backup-card"
    >
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-foreground">
        <DatabaseBackup className="h-5 w-5 text-primary" aria-hidden="true" />
        النسخ الاحتياطي
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">
        بيانات ترتيل كلها محفوظة على هذا الجهاز. احفظ نسخة احتياطية دورياً في
        مكان آخر (الملفات، Google Drive، واتساب) لتستعيدها إن فُقد الهاتف أو
        حُذف التطبيق، أو لتنقلها إلى جهاز جديد.
      </p>
      {allowed === false ? (
        <p className="mt-4 rounded-xl bg-muted/30 p-3 text-sm leading-7 text-foreground">
          النسخة تحوي بيانات كل الحسابات على الجهاز، لذلك يصدّرها ويستعيدها مالك
          المركز فقط.
        </p>
      ) : allowed ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={backup}
            className="btn-gold mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2 text-sm"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy ? "جارٍ التجهيز…" : "حفظ نسخة احتياطية الآن"}
          </button>
          {last ? (
            <p className="mt-2 text-xs text-muted-foreground">
              آخر نسخة من هذا الجهاز: {last}
            </p>
          ) : null}
          <RestoreBackupPanel />
        </>
      ) : null}
    </div>
  );
}

/** صفحة الدخول في جهاز جديد بلا حسابات: استعادة نسخة احتياطية بدل البدء من الصفر. */
export function DeviceLoginRestore() {
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("restored") === "1")
      toast.success("استُعيدت النسخة الاحتياطية؛ ادخل بحسابك");
    void import("@/local/backup")
      .then(({ localDeviceHasAccounts }) => localDeviceHasAccounts())
      .then(
        has => setEmpty(!has),
        () => setEmpty(false)
      );
  }, []);
  if (!empty) return null;
  return (
    <div
      className="mt-4 rounded-xl border border-border bg-muted/20 p-3"
      data-testid="login-restore"
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <DatabaseBackup className="h-4 w-4 text-primary" aria-hidden="true" />
        جهاز جديد؟
      </p>
      <p className="mb-3 text-xs leading-6 text-muted-foreground">
        إن كانت لديك نسخة احتياطية من ترتيل فاستعدها لتعود الحسابات والبيانات
        كما كانت.
      </p>
      <RestoreBackupPanel compact />
    </div>
  );
}
