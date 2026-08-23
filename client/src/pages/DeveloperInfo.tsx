import { DEVELOPER_INFO } from "../../../shared/developer";
import {
  ArrowRight,
  Code2,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";

type ContactItem = {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
  description: string;
  external?: boolean;
  color: string;
};

const contacts: ContactItem[] = [
  {
    label: "الجوال",
    value: DEVELOPER_INFO.phone,
    href: DEVELOPER_INFO.links.phone,
    icon: Phone,
    description: "فتح تطبيق الاتصال",
    color: "bg-emerald-600",
  },
  {
    label: "البريد الإلكتروني",
    value: DEVELOPER_INFO.email,
    href: DEVELOPER_INFO.links.email,
    icon: Mail,
    description: "إنشاء رسالة جديدة",
    color: "bg-amber-500",
  },
  {
    label: "واتساب",
    value: DEVELOPER_INFO.whatsapp,
    href: DEVELOPER_INFO.links.whatsapp,
    icon: MessageCircle,
    description: "فتح واتساب أو المتصفح",
    external: true,
    color: "bg-green-600",
  },
  {
    label: "فيسبوك",
    value: DEVELOPER_INFO.facebook,
    href: DEVELOPER_INFO.links.facebook,
    icon: Globe2,
    description: "البحث عن الحساب في فيسبوك",
    external: true,
    color: "bg-blue-600",
  },
  {
    label: "تلجرام",
    value: DEVELOPER_INFO.telegram,
    href: DEVELOPER_INFO.links.telegram,
    icon: Send,
    description: "فتح تلجرام أو المتصفح",
    external: true,
    color: "bg-sky-500",
  },
];

export default function DeveloperInfo() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl gold-gradient shadow-md">
            <Code2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="page-title">عن المطور</h1>
            <p className="page-subtitle">بيانات التواصل والدعم الفني لمنصة ترتيل</p>
          </div>
        </div>
        <Link href="/settings" className="hidden sm:inline-flex">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <ArrowRight className="h-4 w-4" />
            الإعدادات
          </span>
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-l from-primary/10 via-card to-emerald-500/10 p-6 sm:p-8">
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl gold-gradient text-3xl font-display font-bold text-white shadow-xl shadow-primary/20">
            إ
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary">مطور منصة ترتيل</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-foreground">{DEVELOPER_INFO.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              لتواصل الدعم أو الاستفسارات التقنية المتعلقة بالمنصة، اختر وسيلة التواصل المناسبة من البيانات التالية.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-2xl bg-background/70 px-4 py-3 text-xs text-muted-foreground backdrop-blur sm:self-auto">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            بيانات محلية وآمنة
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <article className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">العنوان</h2>
              <p className="text-sm text-muted-foreground">موقع المطور</p>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{DEVELOPER_INFO.address}</p>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            تظهر بيانات المطور محلياً داخل التطبيق ولا تتطلب أي اتصال بالإنترنت.
          </p>
        </article>

        <article className="glass-card rounded-2xl p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="font-display text-xl font-bold text-foreground">طرق التواصل</h2>
            <p className="mt-1 text-sm text-muted-foreground">اضغط على أي بطاقة لفتح الخدمة المناسبة في جهازك.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((contact) => {
              const Icon = contact.icon;
              return (
                <a
                  key={contact.label}
                  href={contact.href}
                  target={contact.external ? "_blank" : undefined}
                  rel={contact.external ? "noreferrer" : undefined}
                  aria-label={`${contact.label}: ${contact.value}`}
                  className="group flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-background/55 p-4 text-right transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${contact.color} shadow-sm`}>
                    <Icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">{contact.label}</span>
                    <span className="mt-1 block break-words text-sm font-semibold text-foreground">{contact.value}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{contact.description}</span>
                  </span>
                  {contact.external && <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />}
                </a>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}
