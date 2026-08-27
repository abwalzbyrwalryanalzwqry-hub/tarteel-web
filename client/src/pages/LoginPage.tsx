import { clearPendingOAuthLoginAttempt, startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { BookOpen, Chrome, Mail, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { readPendingTeacherInvite } from "../../../shared/teacherInviteFlow";
import { hasActiveAccessMembership } from "../../../shared/accessMembership";
import { AccessHelpPanel } from "@/components/AccessHelpPanel";

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const { data: memberships, isLoading: membershipsLoading } = trpc.access.mine.useQuery(undefined, { enabled: isAuthenticated });
  const [, navigate] = useLocation();
  const oauthStateFailed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("authError") === "oauth_state";

  useEffect(() => {
    if (oauthStateFailed) clearPendingOAuthLoginAttempt();
  }, [oauthStateFailed]);
  const [switchAccount] = useState(() => {
    try { return sessionStorage.getItem("tarteel-switch-account") === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!loading && !membershipsLoading && isAuthenticated) {
      const pendingCode = readPendingTeacherInvite();
      navigate(pendingCode ? `/redeem-teacher-invite?code=${pendingCode}` : hasActiveAccessMembership(memberships) ? "/dashboard" : "/start");
    }
  }, [isAuthenticated, loading, memberships, membershipsLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden" dir="rtl">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl"/>
      </div>

      {/* Islamic pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]" style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a84c' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"}}/>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-card rounded-3xl p-8 text-center shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center shadow-lg">
              <BookOpen className="w-10 h-10 text-white"/>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">ترتيل</h1>
          <p className="text-muted-foreground text-lg mb-1">منصة إدارة مراكز تحفيظ القرآن الكريم</p>
          <div className="flex items-center justify-center gap-1 mb-8">
            {[1,2,3,4,5].map(i=><Star key={i} className="w-4 h-4 fill-primary text-primary"/>)}
          </div>

          {switchAccount && (
            <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-right text-xs leading-6 text-muted-foreground">
              <p className="font-semibold text-foreground">تم تسجيل خروجك من ترتيل.</p>
              <p className="mt-1">إذا عاد موفر المصادقة بالحساب نفسه، فهذه جلسة خارجية مستقلة. لاستخدام حساب آخر افتح ترتيل في نافذة خاصة أو ملف متصفح مختلف، ثم سجّل الدخول بالحساب الثاني هناك.</p>
            </div>
          )}

          {oauthStateFailed && (
            <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-right text-xs leading-6 text-foreground">
              انتهت محاولة الدخول السابقة أو تغيّرت نافذة المتصفح. اضغط زر الدخول مرة واحدة لإعادة المحاولة من هذه الصفحة.
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 mb-8 text-right">
            {[
              { icon: "🕌", text: "إدارة المراكز والفروع" },
              { icon: "📖", text: "تتبع الحفظ والمراجعة" },
              { icon: "👥", text: "إدارة المعلمين والطلاب" },
              { icon: "📊", text: "تقارير وإحصائيات شاملة" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
                <span className="text-xl">{f.icon}</span>
                <span className="text-xs text-muted-foreground">{f.text}</span>
              </div>
            ))}
          </div>

          {/* الدخول المربوط فعلياً بموفر المصادقة الحالي */}
          <button
            onClick={() => startLogin()}
            className="btn-gold w-full text-base py-3 flex items-center justify-center gap-2"
          >
            <Mail className="w-5 h-5"/>
            الدخول الآمن إلى ترتيل
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            أو
            <span className="h-px flex-1 bg-border" />
          </div>

          <button disabled aria-describedby="google-auth-status" className="w-full cursor-not-allowed rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground flex items-center justify-center gap-2">
            <Chrome className="w-5 h-5 text-blue-600"/>
            التسجيل بحساب Google — غير مفعّل بعد
          </button>

          <p id="google-auth-status" className="mt-3 text-xs text-muted-foreground">يتطلب Google بيانات OAuth مستقلة واختبار تحويل حقيقياً قبل تفعيله بصورة آمنة.</p>

          <p className="text-xs text-muted-foreground mt-4">
            بتسجيل الدخول، أنت توافق على شروط الاستخدام وسياسة الخصوصية
          </p>
          <AccessHelpPanel />
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
        </p>
      </div>
    </div>
  );
}
