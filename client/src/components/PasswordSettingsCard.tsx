import { KeyRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** تعيين/تغيير كلمة المرور للدخول المحلي — يستخدمه مستخدمو Manus الحاليون قبل النقل. */
export function PasswordSettingsCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.auth.myCredential.useQuery();
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  useEffect(() => { if (data?.email) setEmail(data.email); }, [data?.email]);
  const save = trpc.auth.setPassword.useMutation({
    onSuccess: async (result) => {
      toast.success(`تم حفظ كلمة المرور. ادخل لاحقاً بالبريد ${result.email}`);
      setCurrent(""); setNext("");
      await utils.auth.myCredential.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ email: data?.hasPassword ? undefined : email.trim() || undefined, currentPassword: data?.hasPassword ? current : undefined, newPassword: next });
  };
  return (
    <div className="glass-card rounded-2xl p-5">
      <h2 className="font-display font-bold text-foreground text-lg mb-1 flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary"/>كلمة المرور</h2>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">{data?.hasPassword ? `تدخل بالبريد ${data.email}.` : "لم تُعيَّن كلمة مرور بعد. عيّنها الآن لتتمكن من الدخول بالبريد وكلمة المرور."}</p>
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
    </div>
  );
}
