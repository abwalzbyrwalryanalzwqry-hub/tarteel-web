import { KeyRound, LogOut, MailCheck, MailWarning } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** تعيين/تغيير كلمة المرور للدخول بالبريد. */
export function PasswordSettingsCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.auth.myCredential.useQuery();
  const { data: emailStatus } = trpc.auth.emailStatus.useQuery();
  const resend = trpc.auth.resendVerification.useMutation({
    onSuccess: (result) => toast.success(result.alreadyVerified ? "بريدك مؤكد مسبقاً" : "أرسلنا رابط التأكيد إلى بريدك"),
    onError: (error) => toast.error(error.message),
  });
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  useEffect(() => { if (data?.email) setEmail(data.email); }, [data?.email]);
  const save = trpc.auth.setPassword.useMutation({
    onSuccess: async (result) => {
      toast.success(`تم حفظ كلمة المرور وخرجت الأجهزة الأخرى. ادخل لاحقاً بالبريد ${result.email}`);
      setCurrent(""); setNext("");
      await utils.auth.myCredential.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const logoutAll = trpc.auth.logoutAll.useMutation({
    onSuccess: async () => {
      utils.auth.me.setData(undefined, null);
      await utils.invalidate();
      window.location.href = "/login";
    },
    onError: (error) => toast.error(error.message),
  });
  const confirmLogoutAll = () => {
    if (window.confirm("سيتم تسجيل الخروج من كل الأجهزة، ومنها هذا الجهاز. هل تريد المتابعة؟")) logoutAll.mutate();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ email: data?.hasPassword ? undefined : email.trim() || undefined, currentPassword: data?.hasPassword ? current : undefined, newPassword: next });
  };
  return (
    <div className="glass-card rounded-2xl p-5">
      <h2 className="font-display font-bold text-foreground text-lg mb-1 flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary"/>كلمة المرور</h2>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">{data?.hasPassword ? `تدخل بالبريد ${data.email}.` : "لم تُعيَّن كلمة مرور بعد. عيّنها الآن لتتمكن من الدخول بالبريد وكلمة المرور."}</p>
      {emailStatus?.email && (
        <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${emailStatus.verified ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <span className="flex items-center gap-1.5">
            {emailStatus.verified ? <MailCheck className="h-4 w-4 text-emerald-600" /> : <MailWarning className="h-4 w-4 text-amber-600" />}
            {emailStatus.verified ? "البريد مؤكد" : "البريد غير مؤكد بعد"}
          </span>
          {!emailStatus.verified && emailStatus.canSend && (
            <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending} className="font-semibold text-primary hover:underline disabled:opacity-60">{resend.isPending ? "جارٍ الإرسال…" : "أرسل رابط التأكيد"}</button>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        {!data?.hasPassword && (
          <label className="block text-sm"><span className="mb-1 block">البريد الإلكتروني للدخول</span>
            <input required type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
        )}
        {data?.hasPassword && (
          <label className="block text-sm"><span className="mb-1 block">كلمة المرور الحالية</span>
            <input required type="password" dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
        )}
        <label className="block text-sm"><span className="mb-1 block">كلمة المرور الجديدة</span>
          <input required type="password" dir="ltr" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
        <button type="submit" disabled={save.isPending} className="btn-gold w-full py-2.5 text-sm disabled:opacity-60">{save.isPending ? "جارٍ الحفظ…" : data?.hasPassword ? "تغيير كلمة المرور" : "تعيين كلمة المرور"}</button>
      </form>
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-xs leading-6 text-muted-foreground">إن فقدت جهازاً أو شككت أن أحداً دخل حسابك، أخرج كل الأجهزة ثم غيّر كلمة المرور.</p>
        <button type="button" onClick={confirmLogoutAll} disabled={logoutAll.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"><LogOut className="h-4 w-4" />{logoutAll.isPending ? "جارٍ الخروج…" : "الخروج من كل الأجهزة"}</button>
      </div>
    </div>
  );
}
