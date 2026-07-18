import { X } from "lucide-react";
import { ReactNode } from "react";

interface EntityFormProps {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
  children: ReactNode;
  submitLabel?: string;
}

export default function EntityForm({
  title,
  onClose,
  onSubmit,
  isLoading,
  children,
  submitLabel = "حفظ",
}: EntityFormProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {children}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-gold flex-1 disabled:opacity-60"
            >
              {isLoading ? "جارٍ الحفظ..." : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reusable form field
export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-destructive mr-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export function FormInput({
  label,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  return (
    <FormField label={label} required={required}>
      <input {...props} required={required} className="tarteel-input" />
    </FormField>
  );
}

export function FormSelect({
  label,
  required,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; children: ReactNode }) {
  return (
    <FormField label={label} required={required}>
      <select {...props} required={required} className="tarteel-input">
        {children}
      </select>
    </FormField>
  );
}

export function FormTextarea({
  label,
  required,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; required?: boolean }) {
  return (
    <FormField label={label} required={required}>
      <textarea {...props} required={required} rows={3} className="tarteel-input resize-none" />
    </FormField>
  );
}
