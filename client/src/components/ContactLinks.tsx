import { MessageCircle, Phone } from "lucide-react";
import { normalizePhone, toLatinDigits } from "../../../shared/phone";

/** رقم دولي للواتساب (دون +): الأرقام المحلية يُضاف إليها رمز الدولة الافتراضي كما في الدخول. */
export function toWhatsAppNumber(phone: string) {
  const normalized = normalizePhone(phone);
  return (normalized ?? toLatinDigits(phone).replace(/\D/g, "")).replace(
    /^\+/,
    ""
  );
}

/** اتصال أو واتساب بنقرة واحدة من البطاقة، دون نسخ الرقم يدوياً. */
export function ContactLinks({
  phone,
  label,
  className = "",
}: {
  phone?: string | null;
  label?: string;
  className?: string;
}) {
  if (!phone?.trim()) return null;
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  return (
    <div
      className={`flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}
    >
      {label && <span className="shrink-0">{label}:</span>}
      <a
        href={`tel:${phone.replace(/\s+/g, "")}`}
        onClick={stop}
        dir="ltr"
        className="inline-flex min-w-0 items-center gap-1 truncate rounded-lg px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        aria-label={`اتصال ${label ? `بـ${label}` : ""} ${phone}`}
      >
        <Phone className="h-3.5 w-3.5 shrink-0" />
        {phone}
      </a>
      <a
        href={`https://wa.me/${toWhatsAppNumber(phone)}`}
        onClick={stop}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
        aria-label={`مراسلة ${label ?? ""} عبر واتساب`}
        title="واتساب"
      >
        <MessageCircle className="h-4 w-4" />
      </a>
    </div>
  );
}
