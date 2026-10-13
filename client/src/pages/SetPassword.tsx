import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** صفحة رابط تعيين كلمة المرور لمرة واحدة (/set-password?token=...). */
export default function SetPassword() {
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") ?? "" : "";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const complete = trpc.auth.completeSetup.useMutation({
    onSuccess: () => {
      toast.success("تم تعيين كلمة المرور وتسجيل دخولك");
      window.setTimeout(() => window.location.assign("/dashboard"), 600);
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    complete.mutate({ token, password, identifier: identifier.trim() || undefined });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
      <section className="glass-card w-full max-w-md rounded-3xl p-6 sm:p-8">
        <KeyRound className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-center font-display text-2xl font-bold">تعيين كلمة المرور</h1>
        {!token ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">الرابط ناقص. اطلب من إدارة المركز رابطاً جديداً.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 text-right">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">البريد الإلكتروني أو رقم الهاتف للدخول</span>
              <input type="text" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="اتركه فارغاً لاستخدام بريد حسابك" className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-left outline-none focus:border-primary" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">كلمة المرور الجديدة</span>
              <input required type="password" dir="ltr" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-left outline-none focus:border-primary" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">تأكيد كلمة المرور</span>
              <input required type="password" dir="ltr" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-left outline-none focus:border-primary" />
            </label>
            <p className="text-xs text-muted-foreground">8 أحرف على الأقل وتحتوي على حروف وأرقام. الرابط يعمل مرة واحدة فقط.</p>
            <button type="submit" disabled={complete.isPending} className="btn-gold w-full py-3 disabled:opacity-60">{complete.isPending ? "جارٍ الحفظ…" : "حفظ والدخول"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
