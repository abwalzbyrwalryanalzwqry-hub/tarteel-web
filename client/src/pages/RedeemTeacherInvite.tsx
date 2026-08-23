import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { clearPendingTeacherInvite, savePendingTeacherInvite } from "../../../shared/teacherInviteFlow";

export default function RedeemTeacherInvite() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "");
  const { isAuthenticated, loading } = useAuth();
  const redeemMutation = trpc.teacherInvites.redeem.useMutation({
    onSuccess: (result) => {
      clearPendingTeacherInvite();
      toast.success(result.role === "teacher" ? "تم تفعيلك معلماً وربطك بالحَلَقة" : "تم تفعيلك معلماً مساعداً وربطك بالحَلَقة");
      window.setTimeout(() => window.location.assign("/dashboard"), 700);
    },
    onError: (error) => toast.error(error.message),
  });

  const startClaimLogin = () => {
    if (code.trim()) savePendingTeacherInvite(code);
    navigate("/login");
  };

  if (!loading && !isAuthenticated) return <div className="mx-auto max-w-xl space-y-6" dir="rtl">
    <div className="glass-card rounded-3xl p-6 sm:p-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><KeyRound className="h-6 w-6" /></div><h1 className="mt-5 font-display text-2xl font-bold text-foreground">دعوة معلم في ترتيل</h1><p className="mt-2 text-sm leading-7 text-muted-foreground">سجّل الدخول أو أنشئ حسابك أولاً؛ سيستمر تفعيل الدعوة تلقائياً بعد المصادقة.</p><label className="mt-6 block"><span className="mb-2 block text-sm font-medium text-foreground">رمز الدعوة</span><input dir="ltr" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="TRTL-1234ABCD" className="tarteel-input text-center font-mono tracking-wider" maxLength={13} required /></label><button onClick={startClaimLogin} className="btn-gold mt-4 w-full py-3 text-sm">الدخول ومتابعة التفعيل</button></div>
  </div>;

  return <div className="mx-auto max-w-xl space-y-6" dir="rtl">
    <div className="glass-card overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><KeyRound className="h-6 w-6" /></div>
      <h1 className="mt-5 font-display text-2xl font-bold text-foreground">استرداد دعوة معلم</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">أدخل رمز الدعوة الذي وصلك من إدارة المركز. يُربط الرمز بحسابك مرة واحدة فقط، ثم تُمنح الصلاحيات المرتبطة بالحَلَقة المحددة.</p>
      <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); redeemMutation.mutate({ code }); }}>
        <label className="block"><span className="mb-2 block text-sm font-medium text-foreground">رمز الدعوة</span><input dir="ltr" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="TRTL-1234ABCD" className="tarteel-input text-center font-mono tracking-wider" maxLength={13} required /></label>
        <button disabled={redeemMutation.isPending} className="btn-gold w-full py-3 text-sm">{redeemMutation.isPending ? "جارٍ التحقق..." : "تفعيل الدعوة"}</button>
      </form>
    </div>
    <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>لا تشارك الرمز بعد تفعيله؛ يحمي النظام الدعوات المنتهية أو الملغاة أو المستخدمة من أي إعادة استخدام.</p></div>
  </div>;
}
