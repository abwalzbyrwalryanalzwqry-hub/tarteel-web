import { BookOpen } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export const SPLASH_DURATION_MS = 4200;

export default function SplashScreen() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => navigate("/login"), SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="absolute inset-0 islamic-pattern opacity-40" aria-hidden="true" />
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />
      <section className="relative z-10 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] gold-gradient shadow-2xl shadow-primary/20">
          <BookOpen className="h-12 w-12 text-white" strokeWidth={1.6} />
        </div>
        <h1 className="font-display text-5xl font-bold tracking-tight text-foreground">ترتيل</h1>
        <p className="mt-3 text-lg text-muted-foreground">أهلاً بك في رحلتك مع كتاب الله</p>
        <div className="mx-auto mt-8 h-1 w-16 overflow-hidden rounded-full bg-primary/15">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </section>
    </main>
  );
}
