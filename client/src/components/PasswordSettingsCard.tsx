import { KeyRound, LogOut, MailCheck, MailWarning, Phone, ShieldCheck, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { WhatsAppVerifyPanel, type WhatsAppSession } from "@/components/WhatsAppVerifyPanel";
import { useConfirm } from "@/components/ConfirmProvider";

const linkedMessage = (count?: number) => (count ? ` ورُبط حسابك بـ ${count === 1 ? "ابنك المسجل" : `${count} من أبنائك المسجلين`} بهذا الرقم` : "");

/** تعيين/تغيير كلمة المرور للدخول بالبريد أو رقم الهاتف. */
export function PasswordSettingsCard() {
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const { data } = trpc.auth.myCredential.useQuery();
  const { data: emailStatus } = trpc.auth.emailStatus.useQuery();
  const resend = trpc.auth.resendVerification.useMutation({
    onSuccess: (result) => toast.success(result.alreadyVerified ? "بريدك مؤكد مسبقاً" : "أرسلنا رابط التأكيد إلى بريدك"),
    onError: (error) => toast.error(error.message),
  });
  const [identifier, setIdentifier] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  useEffect(() => { if (data?.email) setIdentifier(data.email); }, [data?.email]);
  const loginIds = [data?.email, data?.phone].filter((id): id is string => Boolean(id));
  const save = trpc.auth.setPassword.useMutation({
    onSuccess: async (result) => {
      toast.success(`تم حفظ كلمة المرور وخرجت الأجهزة الأخرى. ادخل لاحقاً بـ ${[result.email, result.phone].filter(Boolean).join(" أو ")}`);
      setCurrent(""); setNext("");
      await utils.auth.myCredential.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const [newPhone, setNewPhone] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const smsEnabled = Boolean(data?.smsEnabled);
  const whatsappEnabled = Boolean(data?.whatsappEnabled);
  const verifyEnabled = smsEnabled || whatsappEnabled;
  /** واتساب أولاً (مجاني)، وSMS احتياطياً إن كان مضبوطاً. */
  const [useSms, setUseSms] = useState(false);
  const viaWhatsApp = whatsappEnabled && !(useSms && smsEnabled);
  const [verifyWa, setVerifyWa] = useState<WhatsAppSession | null>(null);
  const [addWa, setAddWa] = useState<WhatsAppSession | null>(null);
  const startVerifyWa = trpc.auth.startMyWhatsAppVerification.useMutation({ onSuccess: setVerifyWa, onError: (error) => toast.error(error.message) });
  const startAddWa = trpc.auth.startMyWhatsAppVerification.useMutation({ onSuccess: setAddWa, onError: (error) => toast.error(error.message) });
  /** مع SMS: إضافة الرقم على خطوتين (رمز إلى الرقم الجديد ثم الحفظ به). */
  const [addCodeSentTo, setAddCodeSentTo] = useState<string | null>(null);
  const [addCode, setAddCode] = useState("");
  const requestAddCode = trpc.auth.requestLoginPhoneCode.useMutation({
    onSuccess: (result) => { setAddCodeSentTo(result.phone); setAddCode(""); toast.success("أرسلنا رمز التحقق إلى الرقم الجديد"); },
    onError: (error) => toast.error(error.message),
  });
  const [verifyCodeSent, setVerifyCodeSent] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const sendVerify = trpc.auth.sendPhoneVerification.useMutation({
    onSuccess: async (result) => {
      if (result.alreadyVerified) { toast.success("رقمك مؤكد مسبقاً"); await utils.auth.myCredential.invalidate(); return; }
      setVerifyCodeSent(true); setVerifyCode(""); toast.success("أرسلنا رمز التحقق برسالة SMS");
    },
    onError: (error) => toast.error(error.message),
  });
  const verify = trpc.auth.verifyPhone.useMutation({
    onSuccess: async (result) => { toast.success(`تم تأكيد رقم الهاتف${linkedMessage("linkedChildren" in result ? result.linkedChildren : undefined)}`); setVerifyCodeSent(false); setVerifyCode(""); setVerifyWa(null); await Promise.all([utils.auth.myCredential.invalidate(), utils.auth.me.invalidate()]); },
    onError: (error) => toast.error(error.message),
  });
  const savePhone = trpc.auth.setLoginPhone.useMutation({
    onSuccess: async (result) => {
      toast.success(`يمكنك الآن الدخول برقم الهاتف ${result.phone}${linkedMessage("linkedChildren" in result ? result.linkedChildren : undefined)}`);
      setNewPhone(""); setPhonePassword(""); setAddCodeSentTo(null); setAddCode(""); setAddWa(null);
      await Promise.all([utils.auth.myCredential.invalidate(), utils.auth.me.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const onVerifyWa = useCallback((ticket: string) => verify.mutate({ ticket }), [verify]);
  const onAddWa = useCallback((ticket: string) => { if (addWa) savePhone.mutate({ phone: addWa.phone, currentPassword: phonePassword, ticket }); }, [addWa, phonePassword, savePhone]);
  const logoutAll = trpc.auth.logoutAll.useMutation({
    onSuccess: async () => {
      utils.auth.me.setData(undefined, null);
      await utils.invalidate();
      window.location.href = "/login";
    },
    onError: (error) => toast.error(error.message),
  });
  const confirmLogoutAll = async () => {
    if (await confirm({ title: "تسجيل الخروج من كل الأجهزة؟", description: "سيتم تسجيل الخروج من كل الأجهزة، ومنها هذا الجهاز.", confirmLabel: "تسجيل الخروج", destructive: true })) logoutAll.mutate();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ identifier: data?.hasPassword ? undefined : identifier.trim() || undefined, currentPassword: data?.hasPassword ? current : undefined, newPassword: next });
  };
  return (
    <div className="glass-card rounded-2xl p-5">
      <h2 className="font-display font-bold text-foreground text-lg mb-1 flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary"/>كلمة المرور</h2>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">{data?.hasPassword ? <>تدخل بـ {loginIds.map((id, index) => <span key={id}>{index > 0 && " أو "}<bdi dir="ltr">{id}</bdi></span>)}.</> : "لم تُعيَّن كلمة مرور بعد. عيّنها الآن لتتمكن من الدخول بالبريد أو رقم الهاتف وكلمة المرور."}</p>
      {emailStatus?.email && (
        <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${emailStatus.verified ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <span className="flex items-center gap-1.5">
            {emailStatus.verified ? <MailCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <MailWarning className="h-4 w-4 text-amber-600 dark:text-amber-300" />}
            {emailStatus.verified ? "البريد مؤكد" : "البريد غير مؤكد بعد"}
          </span>
          {!emailStatus.verified && emailStatus.canSend && (
            <button type="button" onClick={() => resend.mutate()} disabled={resend.isPending} className="font-semibold text-primary hover:underline disabled:opacity-60">{resend.isPending ? "جارٍ الإرسال…" : "أرسل رابط التأكيد"}</button>
          )}
        </div>
      )}
      {data?.phone && verifyEnabled && (
        <div className={`mb-4 space-y-2 rounded-xl border px-3 py-2 text-xs ${data.phoneVerified ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              {data.phoneVerified ? <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" />}
              {data.phoneVerified ? "رقم الهاتف مؤكد" : "رقم الهاتف غير مؤكد؛ أكّده لتستعيد كلمة المرور به"}
            </span>
            {!data.phoneVerified && !viaWhatsApp && (
              <button type="button" onClick={() => sendVerify.mutate()} disabled={sendVerify.isPending} className="shrink-0 font-semibold text-primary hover:underline disabled:opacity-60">{sendVerify.isPending ? "جارٍ الإرسال…" : verifyCodeSent ? "أعد الإرسال" : "أرسل رمز التحقق"}</button>
            )}
          </div>
          {!data.phoneVerified && viaWhatsApp && (
            <>
              <WhatsAppVerifyPanel session={verifyWa} starting={startVerifyWa.isPending || verify.isPending} onStart={() => startVerifyWa.mutate({ purpose: "verify" })} onVerified={onVerifyWa} startLabel="أكّد الرقم عبر واتساب" idleHint="سترسل من واتساب رقمك رمزاً إلى رقم ترتيل. بعد التأكيد يُربط حسابك بأبنائك المسجلين بهذا الرقم في المراكز." />
              {smsEnabled && <button type="button" onClick={() => setUseSms(true)} className="w-full text-primary hover:underline">أرسل رمزاً برسالة SMS بدلاً من ذلك</button>}
            </>
          )}
          {!data.phoneVerified && !viaWhatsApp && whatsappEnabled && (
            <button type="button" onClick={() => setUseSms(false)} className="w-full text-primary hover:underline">التأكيد عبر واتساب بدلاً من ذلك</button>
          )}
          {!data.phoneVerified && !viaWhatsApp && verifyCodeSent && (
            <form onSubmit={(event) => { event.preventDefault(); verify.mutate({ code: verifyCode.trim() }); }} className="flex gap-2">
              <input required type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={10} aria-label="رمز التحقق" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="••••••" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-center tracking-[0.3em] outline-none focus:border-primary" />
              <button type="submit" disabled={verify.isPending || !verifyCode.trim()} className="btn-gold shrink-0 px-4 py-2 text-xs disabled:opacity-60">{verify.isPending ? "…" : "تأكيد"}</button>
            </form>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        {!data?.hasPassword && (
          <label className="block text-sm"><span className="mb-1 block">البريد الإلكتروني أو رقم الهاتف للدخول</span>
            <input required type="text" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
        )}
        {data?.hasPassword && (
          <label className="block text-sm"><span className="mb-1 block">كلمة المرور الحالية</span>
            <input required type="password" dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
        )}
        <label className="block text-sm"><span className="mb-1 block">كلمة المرور الجديدة</span>
          <input required type="password" dir="ltr" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
        <button type="submit" disabled={save.isPending} className="btn-gold w-full py-2.5 text-sm disabled:opacity-60">{save.isPending ? "جارٍ الحفظ…" : data?.hasPassword ? "تغيير كلمة المرور" : "تعيين كلمة المرور"}</button>
      </form>
      {data?.hasPassword && (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (viaWhatsApp) return;
          if (smsEnabled && !addCodeSentTo) requestAddCode.mutate({ phone: newPhone.trim(), currentPassword: phonePassword });
          else savePhone.mutate({ phone: addCodeSentTo ?? newPhone.trim(), currentPassword: phonePassword, code: smsEnabled ? addCode.trim() : undefined });
        }} className="mt-4 space-y-3 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Phone className="h-4 w-4 text-primary" />{data.phone ? "تغيير رقم الهاتف للدخول" : "إضافة رقم هاتف للدخول"}</h3>
          <p className="text-xs leading-6 text-muted-foreground">{data.phone ? <>{data.email ? "تدخل أيضاً بالرقم" : "رقم الدخول الحالي"} <bdi dir="ltr">{data.phone}</bdi>.</> : "أضف رقم هاتفك لتدخل به بدل البريد، بكلمة المرور نفسها."}</p>
          <label className="block text-sm"><span className="mb-1 block">رقم الهاتف</span>
            <input required type="tel" dir="ltr" inputMode="tel" autoComplete="tel" value={newPhone} onChange={(e) => { setNewPhone(e.target.value); setAddCodeSentTo(null); setAddWa(null); }} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
          <label className="block text-sm"><span className="mb-1 block">كلمة المرور الحالية للتأكيد</span>
            <input required type="password" dir="ltr" autoComplete="current-password" value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)} className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left outline-none focus:border-primary" /></label>
          {viaWhatsApp && (
            <div className="space-y-2 rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-3 text-sm">
              <WhatsAppVerifyPanel session={addWa} starting={startAddWa.isPending || savePhone.isPending} disabled={!newPhone.trim() || !phonePassword} onStart={() => startAddWa.mutate({ purpose: "add_phone", phone: newPhone.trim(), currentPassword: phonePassword })} onVerified={onAddWa} startLabel="أكّد الرقم الجديد عبر واتساب" idleHint="سترسل من واتساب الرقم الجديد رمزاً إلى رقم ترتيل، ثم يُحفظ الرقم تلقائياً." />
              {smsEnabled && <button type="button" onClick={() => { setUseSms(true); setAddWa(null); }} className="w-full text-xs text-primary hover:underline">أرسل رمزاً برسالة SMS بدلاً من ذلك</button>}
            </div>
          )}
          {!viaWhatsApp && smsEnabled && addCodeSentTo && (
            <label className="block text-sm"><span className="mb-1 block">رمز التحقق المرسل إلى <bdi dir="ltr">{addCodeSentTo}</bdi></span>
              <input required type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={addCode} onChange={(e) => setAddCode(e.target.value)} placeholder="••••••" className="w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-center tracking-[0.3em] outline-none focus:border-primary" /></label>
          )}
          {!viaWhatsApp && <button type="submit" disabled={savePhone.isPending || requestAddCode.isPending || !newPhone.trim() || !phonePassword || (smsEnabled && Boolean(addCodeSentTo) && !addCode.trim())} className="w-full rounded-xl border border-primary/40 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60">{savePhone.isPending || requestAddCode.isPending ? "جارٍ…" : smsEnabled && !addCodeSentTo ? "أرسل رمز التحقق" : "تأكيد وحفظ رقم الهاتف"}</button>}
          {!viaWhatsApp && whatsappEnabled && <button type="button" onClick={() => setUseSms(false)} className="w-full text-xs text-primary hover:underline">التأكيد عبر واتساب بدلاً من ذلك</button>}
        </form>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-xs leading-6 text-muted-foreground">إن فقدت جهازاً أو شككت أن أحداً دخل حسابك، أخرج كل الأجهزة ثم غيّر كلمة المرور.</p>
        <button type="button" onClick={confirmLogoutAll} disabled={logoutAll.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 py-2.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"><LogOut className="h-4 w-4" />{logoutAll.isPending ? "جارٍ الخروج…" : "الخروج من كل الأجهزة"}</button>
      </div>
    </div>
  );
}
