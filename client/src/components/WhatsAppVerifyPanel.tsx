import {
  CheckCircle2,
  Copy,
  Loader2,
  MessageCircle,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** ما يعيده الخادم عند بدء التحقق العكسي عبر واتساب. */
export type WhatsAppSession = {
  phone: string;
  ticket: string;
  code: string;
  message: string;
  link: string;
  businessNumber: string;
};

/**
 * التحقق العكسي: يعرض الرمز وزر فتح واتساب برسالة جاهزة، ثم يستعلم عن الحالة كل ثانيتين
 * حتى يصل الرمز من واتساب الرقم نفسه. لا رسائل تُرسل منا، فلا تكلفة.
 */
export function WhatsAppVerifyPanel({
  session,
  starting,
  disabled,
  onStart,
  onVerified,
  idleHint,
  startLabel = "تحقق من الرقم عبر واتساب",
}: {
  session: WhatsAppSession | null;
  starting: boolean;
  disabled?: boolean;
  onStart: () => void;
  onVerified: (ticket: string) => void;
  idleHint: string;
  startLabel?: string;
}) {
  const reported = useRef<string | null>(null);
  const { data } = trpc.auth.whatsAppVerificationStatus.useQuery(
    { ticket: session?.ticket ?? "" },
    {
      enabled: Boolean(session),
      refetchInterval: query =>
        query.state.data?.status === "pending" ? 2000 : false,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      retry: false,
    }
  );
  const status = session ? (data?.status ?? "pending") : null;

  useEffect(() => {
    if (
      session &&
      status === "verified" &&
      reported.current !== session.ticket
    ) {
      reported.current = session.ticket;
      onVerified(session.ticket);
    }
  }, [session, status, onVerified]);

  if (!session) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled={disabled || starting}
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/40 py-2 font-semibold text-emerald-700 hover:bg-emerald-600/10 disabled:opacity-60 dark:text-emerald-400"
        >
          <MessageCircle className="h-4 w-4" />
          {starting ? "جارٍ التحضير…" : startLabel}
        </button>
        <p className="text-xs leading-5 text-muted-foreground">{idleHint}</p>
      </div>
    );
  }

  if (status === "verified") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold leading-5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        تم تأكيد الرقم <bdi dir="ltr">{session.phone}</bdi> عبر واتساب.
      </p>
    );
  }

  if (status === "mismatch" || status === "expired") {
    return (
      <div className="space-y-2">
        <p className="flex items-start gap-1.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {status === "mismatch"
            ? "وصل الرمز من رقم واتساب غير الرقم المكتوب. أرسله من واتساب الرقم نفسه بعد طلب رمز جديد."
            : "انتهت مهلة الرمز. اطلب رمزاً جديداً."}
        </p>
        <button
          type="button"
          disabled={disabled || starting}
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {starting ? "جارٍ التحضير…" : "رمز جديد"}
        </button>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(session.message);
      toast.success("نُسخت الرسالة");
    } catch {
      toast.error("تعذر النسخ؛ اكتب الرمز يدوياً");
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-muted-foreground">
        أرسل هذا الرمز من واتساب الرقم <bdi dir="ltr">{session.phone}</bdi> إلى
        رقم ترتيل <bdi dir="ltr">{session.businessNumber}</bdi>:
      </p>
      <div
        dir="ltr"
        className="rounded-lg border border-border bg-background py-2 text-center font-mono text-xl font-bold tracking-[0.25em] text-foreground"
      >
        {session.code}
      </div>
      <a
        href={session.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        <MessageCircle className="h-4 w-4" />
        افتح واتساب وأرسل الرسالة
      </a>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ننتظر وصول رسالتك… (الرمز صالح 10 دقائق)
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
        >
          <Copy className="h-3.5 w-3.5" />
          نسخ
        </button>
      </div>
    </div>
  );
}
