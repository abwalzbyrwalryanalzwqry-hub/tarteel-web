import { UI_LOCALE } from "@shared/dates";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileBarChart,
  NotebookPen,
  Star,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { usePermissions } from "@/hooks/usePermissions";
import { segmentsText } from "@/mushaf/lib/daily-record-text";
import { gradeLabel, gradeOf } from "@/mushaf/lib/grading";

type ProfileTab = "summary" | "days" | "notes";
const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: "summary", label: "الملخص" },
  { id: "days", label: "أيام السجل" },
  { id: "notes", label: "الملاحظات" },
];

const STATUS: Record<string, { label: string; tone: string }> = {
  present: { label: "حاضر", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  late: { label: "متأخر", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  absent: { label: "غائب", tone: "bg-destructive/10 text-destructive" },
  excused: { label: "مستأذن", tone: "bg-primary/10 text-primary" },
};

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(UI_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const scoreText = (score: number | null | undefined) =>
  score == null ? "" : ` · ${gradeLabel(gradeOf(score))}`;

/**
 * ملف الطالب: كل بياناته من السجل اليومي للحلقة (حضور آخر 30 يوماً، وآخر حفظ ومراجعة وتقييم، وأيامه
 * وملاحظاته)، مع إجراء مباشر لتسجيل يومه أو استخراج تقريره.
 */
export default function StudentProfile({ studentId }: { studentId?: number }) {
  const { can, role } = usePermissions();
  const isReader = role === "student" || role === "guardian";
  const [activeTab, setActiveTab] = useState<ProfileTab>("summary");
  const enabled = Boolean(studentId);
  const student = studentId ?? 0;
  const profile = trpc.students.byId.useQuery({ id: student }, { enabled });
  const overview = trpc.daily.studentOverview.useQuery({ student }, { enabled });
  const days = trpc.daily.studentDays.useQuery({ student, limit: 120 }, { enabled });

  if (profile.isLoading || overview.isLoading)
    return (
      <div className="space-y-4">
        <div className="skeleton h-44 rounded-3xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    );
  const info = profile.data;
  if (!info)
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">ملف الطالب غير متاح.</p>
        <Link href="/students" className="btn-gold mt-4 inline-flex px-4 py-2 text-sm">
          العودة للطلاب
        </Link>
      </div>
    );

  const o = overview.data;
  const att = o?.attendance ?? { present: 0, late: 0, absent: 0, excused: 0 };
  const marked = att.present + att.late + att.absent + att.excused;
  const rate = marked ? Math.round(((att.present + att.late) / marked) * 100) : null;
  const evaluation = o?.last_evaluation;
  const evalAvg = evaluation
    ? (() => {
        const v = [evaluation.overall, evaluation.tajweed, evaluation.pronunciation, evaluation.behavior].filter(
          (x): x is number => typeof x === "number"
        );
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      })()
    : null;
  const circleId = info.circleId;
  const rows = days.data ?? [];

  return (
    <div className="space-y-6" dir="rtl">
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" />
        الطلاب
      </Link>
      <section className="glass-card rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 font-display text-2xl font-bold text-primary">
            {info.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{info.name}</h1>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${info.isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
              >
                {info.isActive ? "نشط" : "موقوف"}
              </span>
            </div>
            {circleId && !isReader && (
              <Link href={`/circles/${circleId}`} className="mt-1 inline-block text-sm text-primary hover:underline">
                صفحة الحلقة
              </Link>
            )}
          </div>
          {!isReader && circleId && (
            <div className="flex flex-wrap gap-2">
              {can("daily:manage") && (
                <Link
                  href={`/daily?halaqa=${circleId}&student=${info.id}`}
                  className="btn-gold flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <ClipboardList className="h-4 w-4" />
                  تسجيل اليوم
                </Link>
              )}
              {can("reports:view") && (
                <Link
                  href={`/reports?halaqa=${circleId}&student=${info.id}`}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  <FileBarChart className="h-4 w-4 text-primary" />
                  تقرير الطالب
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
      {!isReader && <AIGuidanceCard context="students" />}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted/50 p-1" role="tablist">
        {profileTabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "summary" && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="نسبة الحضور (30 يوماً)" value={rate === null ? "—" : `${rate}%`} icon={<UserRound className="h-4 w-4" />} tone="text-emerald-700 dark:text-emerald-300" />
            <Stat label="الغياب" value={att.absent} icon={<Clock3 className="h-4 w-4" />} tone="text-destructive" />
            <Stat label="التأخر" value={att.late} icon={<CalendarDays className="h-4 w-4" />} tone="text-amber-600 dark:text-amber-300" />
            <Stat label="الاستئذان" value={att.excused} icon={<CalendarDays className="h-4 w-4" />} tone="text-primary" />
          </section>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card title="آخر حفظ" icon={<BookOpen className="h-5 w-5 text-primary" />}>
              {o?.last_memorize ? (
                <>
                  <p className="font-semibold text-foreground">{segmentsText([o.last_memorize])}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dayLabel(o.last_memorize.session_date)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">لم يُسجّل بعد</p>
              )}
            </Card>
            <Card title="آخر مراجعة" icon={<ClipboardList className="h-5 w-5 text-primary" />}>
              {o?.last_review ? (
                <>
                  <p className="font-semibold text-foreground">{segmentsText([o.last_review])}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dayLabel(o.last_review.session_date)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">لم تُسجّل بعد</p>
              )}
            </Card>
            <Card title="آخر تقييم" icon={<Star className="h-5 w-5 text-primary" />}>
              {evaluation && evalAvg !== null ? (
                <>
                  <Stars value={evalAvg} />
                  <p className="mt-1 text-xs text-muted-foreground">{dayLabel(evaluation.session_date)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">لا يوجد تقييم بعد</p>
              )}
            </Card>
          </section>
        </>
      )}

      {activeTab === "days" && (
        <section className="space-y-3">
          {days.isLoading && <div className="skeleton h-24 rounded-2xl" />}
          {days.data && !rows.length && <EmptyCard text="لا توجد أيام مسجلة لهذا الطالب بعد." />}
          {rows.map(day => {
            const status = day.status ? STATUS[day.status] : null;
            return (
              <div key={`${day.date}-${day.circleId}`} className="glass-card rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{dayLabel(day.date)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status ? status.tone : "bg-muted text-muted-foreground"}`}>
                    {status ? status.label : "لم يُرصد"}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {day.memorize && (
                    <p>
                      حفظ: <span className="text-foreground">{segmentsText(day.memorize.segments)}</span>
                      {scoreText(day.memorize.score)}
                    </p>
                  )}
                  {day.review && (
                    <p>
                      مراجعة: <span className="text-foreground">{segmentsText(day.review.segments)}</span>
                      {scoreText(day.review.score)}
                    </p>
                  )}
                  {day.reason && <p>السبب: {day.reason}</p>}
                  {day.note && <p>ملاحظة: {day.note}</p>}
                </div>
                {!isReader && (
                  <Link
                    href={`/daily?halaqa=${day.circleId}&date=${day.date}&student=${info.id}`}
                    className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    فتح في السجل اليومي
                  </Link>
                )}
              </div>
            );
          })}
        </section>
      )}

      {activeTab === "notes" && (
        <section className="space-y-3">
          {!o?.notes.length && <EmptyCard text="لا توجد ملاحظات بعد." />}
          {o?.notes.map(n => (
            <div key={`${n.session_date}-${n.note}`} className="glass-card flex gap-3 rounded-2xl p-4">
              <NotebookPen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm text-foreground">{n.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dayLabel(n.session_date)}</p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value, icon, tone }: { label: string; value: ReactNode; icon: ReactNode; tone: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-2 font-display text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 text-primary" aria-label={`${Math.round(value)} من 5`}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star key={star} className="h-5 w-5" fill={star <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </div>
  );
}
function EmptyCard({ text }: { text: string }) {
  return <div className="glass-card rounded-2xl py-10 text-center text-sm text-muted-foreground">{text}</div>;
}
