import { ArrowRight, Compass, Home } from "lucide-react";
import { useLocation } from "wouter";

/** صفحة غير موجودة بهوية ترتيل وبالعربية، وتعمل في الوضعين الفاتح والليلي. */
export default function NotFound() {
  const [, setLocation] = useLocation();
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <main
      dir="rtl"
      className="islamic-pattern flex min-h-screen w-full items-center justify-center bg-background px-4"
    >
      <section className="glass-card w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl gold-gradient shadow-lg">
          <Compass className="h-8 w-8 text-white" aria-hidden="true" />
        </div>
        <p className="font-display text-5xl font-bold text-primary">404</p>
        <h1 className="mt-3 font-display text-2xl font-bold text-foreground">
          الصفحة غير موجودة
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          ربما نُقلت هذه الصفحة أو حُذفت، أو أن الرابط غير صحيح.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="btn-gold flex min-h-11 items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            الصفحة الرئيسية
          </button>
          {canGoBack && (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              رجوع
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
