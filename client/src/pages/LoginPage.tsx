import { useAuth } from "@/_core/hooks/useAuth";
import { BookOpen, KeyRound, LogIn, Mail, Phone, Star, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { clearPendingTeacherInvite, readPendingTeacherInvite } from "../../../shared/teacherInviteFlow";
import { hasActiveAccessMembership } from "../../../shared/accessMembership";
import { AccessHelpPanel } from "@/components/AccessHelpPanel";
import { looksLikePhone } from "../../../shared/phone";

const GOOGLE_ERRORS: Record<string, string> = {
  not_configured: "الدخول بـ Google غير مفعّل على هذا الخادم.",
  state: "انتهت مهلة الدخول بـ Google أو فُتح من نافذة أخرى؛ حاول مجدداً.",
  exchange: "تعذر إكمال الدخول بـ Google؛ حاول مجدداً.",
  unverified_email: "بريد حساب Google غير مؤكد، فلا يمكن ربطه بحساب في ترتيل.",
  signup_closed: "لا يوجد حساب في ترتيل بهذا البريد. أنشئ حساباً برمز الدعوة من تبويب «حساب جديد» ثم اضغط «المتابعة بـ Google».",
  invite_invalid: "رمز الدعوة أو كود الدخول غير صالح أو منتهٍ.",
  inactive: "هذا الحساب موقوف؛ تواصل مع إدارة المركز.",
  rate_limited: "محاولات كثيرة، حاول بعد ربع ساعة.",
};

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const { data: memberships, isLoading: membershipsLoading } = trpc.access.mine.useQuery(undefined, { enabled: isAuthenticated });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: providers } = trpc.auth.providers.useQuery(undefined, { staleTime: 5 * 60_000 });
  const [initialParams] = useState(() => new URLSearchParams(window.location.search));
  const [mode, setMode] = useState<"login" | "register">(() => (initialParams.get("mode") === "register" || initialParams.get("code") ? "register" : "login"));
  const [inviteCode, setInviteCode] = useState(() => (initialParams.get("code") ?? readPendingTeacherInvite() ?? "").toUpperCase());
  const signupOpen = Boolean(providers?.allowSignup);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const requestReset = trpc.auth.requestPasswordReset.useMutation({ onSuccess: () => setResetSent(true), onError: (e) => toast.error(e.message) });
  const googleHref = `/api/auth/google${mode === "register" && inviteCode.trim() ? `?invite=${encodeURIComponent(inviteCode.trim())}` : ""}`;
  const canRegister = signupOpen || Boolean(providers?.inviteSignup);
  const [name, setName] = useState("");
  /** الدخول: حقل واحد يقبل البريد أو رقم الهاتف. */
  const [identifier, setIdentifier] = useState("");
  /** التسجيل: بالبريد أو برقم الهاتف. */
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const phoneEnabled = providers?.phone !== false;
  const countryCode = providers?.phoneCountryCode ?? "967";
  const identifierIsPhone = looksLikePhone(identifier);
  const onAuthSuccess = async () => { setPassword(""); try { sessionStorage.removeItem("tarteel-switch-account"); } catch {} await utils.auth.me.invalidate(); };
  const loginMutation = trpc.auth.login.useMutation({ onSuccess: onAuthSuccess, onError: (e) => toast.error(e.message) });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (result) => {
      // الدعوة استُردت مع إنشاء الحساب؛ لا نعيد المستخدم إلى صفحة استردادها.
      if (result.role) clearPendingTeacherInvite();
      toast.success(result.role ? "تم إنشاء حسابك وتفعيل الدعوة" : "تم إنشاء حسابك");
      await onAuthSuccess();
    },
    onError: (e) => toast.error(e.message),
  });
  const busy = loginMutation.isPending || registerMutation.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "login") loginMutation.mutate({ identifier, password });
    else {
      const usePhone = phoneEnabled && signupMethod === "phone";
      registerMutation.mutate({
        name,
        email: usePhone ? undefined : email,
        phone: usePhone ? phone : undefined,
        password,
        inviteCode: inviteCode.trim() || undefined,
      });
    }
  };
  const [switchAccount] = useState(() => {
    try { return sessionStorage.getItem("tarteel-switch-account") === "1"; } catch { return false; }
  });

  useEffect(() => {
    const code = initialParams.get("google_error");
    if (code) toast.error(GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.exchange, { duration: 8000 });
  }, [initialParams]);

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
              <p className="mt-1">يمكنك الآن الدخول بحساب آخر ببريده أو رقم هاتفه وكلمة مروره.</p>
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

          {providers?.local !== false && (
            <form onSubmit={submit} className="space-y-3 text-right" noValidate>
              {canRegister && (
                <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 text-sm" role="tablist">
                  <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")} className={`rounded-lg py-2 font-semibold transition-colors ${mode === "login" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}>تسجيل الدخول</button>
                  <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")} className={`rounded-lg py-2 font-semibold transition-colors ${mode === "register" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}>حساب جديد</button>
                </div>
              )}
              {mode === "register" && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">{signupOpen ? "رمز الدعوة أو كود الدخول (اختياري)" : "رمز الدعوة أو كود الدخول"}</span>
                  <input required={!signupOpen} dir="ltr" autoComplete="off" spellCheck={false} value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="TRTL-1234ABCD" className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-center font-mono tracking-wider outline-none focus:border-primary" />
                  <span className="mt-1 block text-xs text-muted-foreground">{signupOpen ? "إن كان معك رمز من المركز أدخله ليُفعَّل دورك مباشرة." : "إنشاء الحسابات متاح لمن وصله رمز من إدارة المركز."}</span>
                </label>
              )}
              {mode === "register" && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">الاسم الكامل</span>
                  <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 outline-none focus:border-primary" />
                </label>
              )}
              {mode === "login" ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-foreground">{phoneEnabled ? "البريد الإلكتروني أو رقم الهاتف" : "البريد الإلكتروني"}</span>
                  <input required type="text" dir="ltr" inputMode={identifierIsPhone ? "tel" : "email"} autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-left outline-none focus:border-primary" />
                </label>
              ) : (
                <>
                  {phoneEnabled && (
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 text-xs" role="radiogroup" aria-label="طريقة التسجيل">
                      <button type="button" role="radio" aria-checked={signupMethod === "email"} onClick={() => setSignupMethod("email")} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-colors ${signupMethod === "email" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}><Mail className="h-3.5 w-3.5" />بالبريد</button>
                      <button type="button" role="radio" aria-checked={signupMethod === "phone"} onClick={() => setSignupMethod("phone")} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-colors ${signupMethod === "phone" ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}><Phone className="h-3.5 w-3.5" />برقم الهاتف</button>
                    </div>
                  )}
                  {phoneEnabled && signupMethod === "phone" ? (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-foreground">رقم الهاتف</span>
                      <input required type="tel" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`+${countryCode} …`} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-left outline-none focus:border-primary" />
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">الرقم المحلي يُكمَّل برمز الدولة <bdi dir="ltr">+{countryCode}</bdi>؛ لرقم من دولة أخرى اكتبه كاملاً مع رمزها. ستدخل لاحقاً بهذا الرقم.</span>
                    </label>
                  ) : (
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-foreground">البريد الإلكتروني</span>
                      <input required type="email" dir="ltr" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-left outline-none focus:border-primary" />
                    </label>
                  )}
                </>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">كلمة المرور</span>
                <input required type="password" dir="ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-left outline-none focus:border-primary" />
                {mode === "register" && <span className="mt-1 block text-xs text-muted-foreground">8 أحرف على الأقل وتحتوي على حروف وأرقام.</span>}
              </label>
              <button type="submit" disabled={busy} className="btn-gold w-full text-base py-3 flex items-center justify-center gap-2 disabled:opacity-60">
                {mode === "login" ? <LogIn className="w-5 h-5"/> : <UserPlus className="w-5 h-5"/>}
                {busy ? "جارٍ التحقق…" : mode === "login" ? "الدخول إلى ترتيل" : "إنشاء الحساب"}
              </button>
              {providers?.passwordReset ? (
                mode === "login" && <button type="button" onClick={() => { setResetOpen((v) => !v); setResetSent(false); }} className="flex items-center gap-1.5 text-xs text-primary hover:underline"><KeyRound className="h-3.5 w-3.5 shrink-0"/>نسيت كلمة المرور؟</button>
              ) : (
                <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0"/>نسيت كلمة المرور؟ اطلب من إدارة المركز رابط تعيين كلمة مرور جديدة.</p>
              )}
            </form>
          )}

          {resetOpen && mode === "login" && providers?.passwordReset && (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-right text-sm">
              {resetSent ? (
                <p className="leading-7 text-foreground">إن كان البريد مسجّلاً فستصلك رسالة فيها رابط صالح 30 دقيقة. افحص مجلد الرسائل غير المرغوب فيها أيضاً.</p>
              ) : (
                <form onSubmit={(event) => { event.preventDefault(); requestReset.mutate({ email: identifier.trim() }); }} className="space-y-2">
                  <p className="text-xs leading-6 text-muted-foreground">{identifierIsPhone ? "الاستعادة بالبريد فقط. إن كان حسابك برقم الهاتف فاطلب من إدارة المركز رابط تعيين كلمة مرور جديدة." : "أدخل بريد حسابك في الحقل أعلاه ثم اضغط الزر لنرسل لك رابط تعيين كلمة مرور جديدة."}</p>
                  <button type="submit" disabled={requestReset.isPending || !identifier.trim() || identifierIsPhone} className="w-full rounded-xl border border-primary/40 py-2.5 font-semibold text-primary hover:bg-primary/10 disabled:opacity-60">{requestReset.isPending ? "جارٍ الإرسال…" : "أرسل رابط الاستعادة"}</button>
                </form>
              )}
            </div>
          )}

          {providers?.google && (
            <div className="mt-4">
              <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>أو<span className="h-px flex-1 bg-border"/></div>
              <a href={googleHref} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted/40">
                <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                {mode === "register" ? "إنشاء الحساب بـ Google" : "المتابعة بـ Google"}
              </a>
            </div>
          )}

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
