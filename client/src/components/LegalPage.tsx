import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DEVELOPER_INFO } from "../../../shared/developer";

/** تاريخ آخر تحديث للسياسة والشروط؛ يُحدَّث مع كل تعديل في نصهما. */
export const LEGAL_LAST_UPDATED = "13 أكتوبر 2026";

export const LEGAL_LINKS = [
  { href: "/privacy", label: "سياسة الخصوصية" },
  { href: "/terms", label: "شروط الاستخدام" },
  { href: "/delete-account", label: "حذف الحساب" },
] as const;

/** إطار الصفحات العامة (الخصوصية، الشروط، حذف الحساب): تُفتح دون تسجيل دخول. */
export function LegalPage({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon: LucideIcon;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const back =
    typeof window !== "undefined" && window.history.length > 1
      ? () => window.history.back()
      : () => (window.location.href = "/login");
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12" dir="rtl">
      <article className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={back}
          className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          رجوع
        </button>
        <header className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {title}
            </h1>
          </div>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            {intro}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            آخر تحديث: {LEGAL_LAST_UPDATED}
          </p>
        </header>
        <div className="mt-6 space-y-4">{children}</div>
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {LEGAL_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/login"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            الدخول إلى ترتيل
          </a>
        </footer>
      </article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-8 text-foreground/90 [&_li]:ms-5 [&_li]:ps-1 [&_ul>li]:list-disc">
        {children}
      </div>
    </section>
  );
}

/** وسائل التواصل في الصفحات القانونية، من بيانات المطور نفسها. */
export function LegalContact() {
  return (
    <ul>
      <li>
        البريد:{" "}
        <a
          href={DEVELOPER_INFO.links.email}
          dir="ltr"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {DEVELOPER_INFO.email}
        </a>
      </li>
      <li>
        واتساب:{" "}
        <a
          href={DEVELOPER_INFO.links.whatsapp}
          dir="ltr"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          +967 {DEVELOPER_INFO.phone}
        </a>
      </li>
      <li>المطور: {DEVELOPER_INFO.name}</li>
    </ul>
  );
}
