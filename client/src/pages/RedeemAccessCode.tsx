import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AccessHelpPanel } from "@/components/AccessHelpPanel";

export default function RedeemAccessCode() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const { isAuthenticated, loading } = useAuth();
  const redeem = trpc.access.codes.redeem.useMutation({
    onSuccess: (result) => {
      toast.success(`تم تفعيل الحساب بدور ${result.role}`);
      window.setTimeout(() => window.location.assign("/dashboard"), 600);
    },
    onError: (error) => toast.error(error.message || "تعذر تفعيل الكود"),
  });

  if (!loading && !isAuthenticated) {
    return (
      <main className="access-redemption-shell" dir="rtl">
        <section className="glass-card rounded-3xl p-5 text-center sm:p-7">
          <KeyRound className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">فعّل حسابك بكود الدخول</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">يلزم تسجيل الدخول أولاً للتحقق من الهوية، ثم أدخل الكود الممنوح لك من المركز. لا يمنح الكود أي صلاحية خارج دوره ونطاقه.</p>
          <button onClick={() => navigate("/login")} className="btn-gold mt-6 w-full py-3">تسجيل الدخول أولاً</button>
        </section>
      </main>
    );
  }

  return (
    <main className="access-redemption-shell" dir="rtl">
      <section className="glass-card rounded-3xl p-5 sm:p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">استرداد كود الدخول</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">يُستعمل الكود وفق صلاحيته وعدد مرات استخدامه ووقت انتهائه. تُسجل المحاولات لحماية الحسابات من التخمين الآلي.</p>

        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); redeem.mutate({ code }); }}>
          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium">كود الدخول</span>
            <input
              dir="ltr"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="TRT-XXXXX-XXXXX-XXXXX-XXXXX"
              className="tarteel-input access-code-input text-center font-mono"
              maxLength={32}
              required
            />
          </label>
          <button disabled={redeem.isPending || !code.trim()} className="btn-gold w-full py-3">
            {redeem.isPending ? "جارٍ التحقق…" : "تفعيل الحساب"}
          </button>
        </form>
      </section>

      <aside className="mt-4 flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p>بعد التفعيل لا يظهر الكود في الأرشيف؛ يطلب من الإدارة إصدار كود بديل عند الحاجة.</p>
      </aside>
      <AccessHelpPanel onCreateCenter={() => navigate("/start")} />
    </main>
  );
}
