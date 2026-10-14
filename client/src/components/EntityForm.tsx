import { X } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

interface EntityFormProps {
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
  children: ReactNode;
  submitLabel?: string;
  /** زر ثانٍ «حفظ وإضافة آخر» للإدخال المتتابع دون إغلاق النموذج. */
  addAnotherLabel?: string;
}

/** هل ضُغط زر «حفظ وإضافة آخر» في هذا الإرسال؟ */
export function isAddAnotherSubmit(event: React.FormEvent<HTMLFormElement>) {
  const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
  return submitter?.dataset.addAnother === "1";
}

export default function EntityForm({
  title,
  description,
  onClose,
  onSubmit,
  isLoading,
  children,
  submitLabel = "حفظ",
  addAnotherLabel,
}: EntityFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  // التركيز على أول حقل فارغ فوراً، وEsc يغلق، ومنع تمرير الصفحة خلف النافذة.
  useEffect(() => {
    const first = formRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])"
    );
    first?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl animate-fade-in-up sm:rounded-2xl sm:border sm:border-border">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
            {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>

          {/* الأزرار ثابتة أسفل النافذة: لا حاجة للتمرير للوصول إلى الحفظ. */}
          <div className="flex flex-wrap gap-2 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold flex-1 disabled:opacity-60"
            >
              {isLoading ? "جارٍ الحفظ..." : submitLabel}
            </button>
            {addAnotherLabel && (
              <button
                type="submit"
                data-add-another="1"
                disabled={isLoading}
                className="flex-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
              >
                {addAnotherLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reusable form field: التسمية تغلّف الحقل فيتركز عند لمسها (وتقرؤها قارئات الشاشة).
export function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive mr-1">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function FormInput({
  label,
  required,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean; hint?: string }) {
  return (
    <FormField label={label} required={required} hint={hint}>
      <input {...props} required={required} className="tarteel-input" />
    </FormField>
  );
}

/** رقم هاتف: لوحة أرقام على الجوال، واتجاه يسار-يمين، وإكمال تلقائي. */
export function FormPhoneInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean; hint?: string }) {
  return <FormInput type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder="77XXXXXXX" {...props} />;
}

export function FormSelect({
  label,
  required,
  hint,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <FormField label={label} required={required} hint={hint}>
      <select {...props} required={required} className="tarteel-input">
        {children}
      </select>
    </FormField>
  );
}

export function FormTextarea({
  label,
  required,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; required?: boolean; hint?: string }) {
  return (
    <FormField label={label} required={required} hint={hint}>
      <textarea {...props} required={required} rows={3} className="tarteel-input resize-none" />
    </FormField>
  );
}

/** تفاصيل إضافية مطوية: النموذج يبدأ بالحقول الأساسية فقط، ويُفتح الباقي عند الحاجة. */
export function FormMore({ label = "بيانات إضافية (اختياري)", children, defaultOpen = false }: { label?: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-border/70 bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        {label}
        <span className="text-xs transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-4 border-t border-border/60 p-3">{children}</div>
    </details>
  );
}
