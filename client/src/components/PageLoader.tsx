/** شاشة انتظار خفيفة أثناء تحميل ملف الصفحة (لا تعتمد على أي مكتبة حتى تظهر فوراً). */
export function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      className={`flex flex-col items-center justify-center gap-3 text-muted-foreground ${fullScreen ? "min-h-screen bg-background" : "min-h-[40vh]"}`}
    >
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" aria-hidden="true" />
      <span className="text-sm">جارٍ التحميل…</span>
    </div>
  );
}
