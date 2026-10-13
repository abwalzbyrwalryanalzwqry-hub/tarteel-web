import { MailCheck, MailX } from "lucide-react";
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

/** صفحة رابط تأكيد البريد (/verify-email?token=...). */
export default function VerifyEmail() {
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") ?? "" : "";
  const verify = trpc.auth.verifyEmail.useMutation();
  const started = useRef(false);
  useEffect(() => {
    // مرة واحدة فقط: الرابط يُستهلك عند أول استخدام.
    if (token && !started.current) {
      started.current = true;
      verify.mutate({ token });
    }
  }, [token, verify]);

  const failed = !token || verify.isError;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <section className="glass-card w-full max-w-md rounded-3xl p-6 text-center sm:p-8">
        {failed ? <MailX className="mx-auto h-10 w-10 text-destructive" /> : <MailCheck className="mx-auto h-10 w-10 text-primary" />}
        <h1 className="mt-4 font-display text-2xl font-bold">تأكيد البريد</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground" role="status">
          {!token
            ? "الرابط ناقص. افتح الرابط كاملاً من الرسالة."
            : verify.isPending || verify.isIdle
              ? "جارٍ التأكيد…"
              : verify.isSuccess
                ? "تم تأكيد بريدك. يمكنك الآن استعادة كلمة المرور به إن نسيتها."
                : verify.error?.message}
        </p>
        <a href="/login" className="btn-gold mt-6 inline-block w-full py-3">الذهاب إلى ترتيل</a>
      </section>
    </main>
  );
}
