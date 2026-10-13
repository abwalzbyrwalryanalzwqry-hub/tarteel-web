import { AlertTriangle, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** بطاقة «حذف الحساب» في الإعدادات: حذف نهائي بعبارة تأكيد وكلمة المرور. */
export function DeleteAccountCard() {
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.auth.deletionStatus.useQuery();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const remove = trpc.auth.deleteAccount.useMutation({
    onSuccess: async () => {
      utils.auth.me.setData(undefined, null);
      await utils.invalidate();
      toast.success("حُذف حسابك نهائياً");
      window.location.href = "/login";
    },
    onError: error => toast.error(error.message),
  });

  const phrase = status?.confirmationPhrase ?? "احذف حسابي";
  const ready =
    confirmation.trim() === phrase &&
    (!status?.requiresPassword || password.length > 0);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || remove.isPending) return;
    remove.mutate({
      confirmation: confirmation.trim(),
      password: status?.requiresPassword ? password : undefined,
    });
  };

  const counts = status?.counts;
  return (
    <div className="glass-card rounded-2xl border border-destructive/30 p-5">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-foreground">
        <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
        حذف الحساب
      </h2>
      <p className="text-sm leading-7 text-muted-foreground">
        يحذف بيانات دخولك وعلاماتك في المصحف وإشعاراتك وعضوياتك في المراكز
        نهائياً. سجلات المركز التعليمية تبقى لدى المركز دون ارتباط بحسابك.{" "}
        <a
          href="/delete-account"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          التفاصيل
        </a>
      </p>

      {isLoading ? null : status?.blocker ? (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm leading-7 text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          {status.blocker}
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive hover:bg-destructive/5"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          حذف حسابي…
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {counts &&
          (counts.bookmarks > 0 ||
            counts.notifications > 0 ||
            counts.centers > 0) ? (
            <div className="rounded-xl bg-muted/30 p-3 text-sm leading-7 text-foreground">
              <p className="font-medium">سيُحذف من حسابك:</p>
              <ul className="ms-5 list-disc">
                {counts.centers > 0 && (
                  <li>عضويات المراكز وصلاحياتها ({counts.centers})</li>
                )}
                {counts.bookmarks > 0 && (
                  <li>علامات المصحف ({counts.bookmarks})</li>
                )}
                {counts.notifications > 0 && (
                  <li>الإشعارات ({counts.notifications})</li>
                )}
              </ul>
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              اكتب «<strong className="text-foreground">{phrase}</strong>»
              للتأكيد
            </span>
            <input
              required
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 outline-none focus:border-destructive"
            />
          </label>
          {status?.requiresPassword && (
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">
                كلمة المرور
              </span>
              <input
                required
                type="password"
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-destructive"
              />
            </label>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={!ready || remove.isPending}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {remove.isPending ? "جارٍ الحذف…" : "حذف حسابي نهائياً"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setPassword("");
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/40"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
