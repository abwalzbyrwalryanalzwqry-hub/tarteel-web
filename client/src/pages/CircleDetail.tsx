import { UI_LOCALE } from "@shared/dates";
import { trpc } from "@/lib/trpc";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import {
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  FileBarChart,
  UserPlus,
  UserRoundCheck,
  UserRoundPlus,
  UserRoundX,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { getRiyadhDayKey } from "../../../shared/dates";
import { usePermissions } from "@/hooks/usePermissions";
import { segmentsText } from "@/mushaf/lib/daily-record-text";

type Props = { circleId?: number };
type TabId = "students" | "days" | "members";

const tabLabels: { id: TabId; label: string }[] = [
  { id: "students", label: "الطلاب" },
  { id: "days", label: "السجلات السابقة" },
  { id: "members", label: "الأعضاء" },
];

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  present: { label: "حاضر", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  late: { label: "متأخر", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  absent: { label: "غائب", tone: "bg-destructive/10 text-destructive" },
  excused: { label: "مستأذن", tone: "bg-primary/10 text-primary" },
};

const RECORD_STATUS: Record<string, string> = {
  open: "مفتوح",
  completed: "مكتمل",
  locked: "مقفل",
};

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(UI_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

/**
 * صفحة الحلقة: لوحة تشغيل مختصرة فوق السجل اليومي. حالة اليوم وآخر إنجاز لكل طالب من سجل اليوم،
 * والأيام السابقة من سجل الحلقة، وكل إجراء (التحضير والتسميع والتقارير) يفتح السجل اليومي مباشرة.
 */
export default function CircleDetail({ circleId }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("students");
  const today = useMemo(() => getRiyadhDayKey(new Date()), []);
  const enabled = Boolean(circleId);
  const halaqa = circleId ?? 0;

  const { data: circle, isLoading } = trpc.circles.byId.useQuery({ id: halaqa }, { enabled });
  const { data: teachers } = trpc.teachers.list.useQuery({ centerId: undefined });
  const sheet = trpc.daily.sheet.useQuery({ halaqa, date: today }, { enabled, retry: false });
  const history = trpc.daily.history.useQuery({ halaqa, limit: 30 }, { enabled, retry: false });
  const { can } = usePermissions();
  const canAddStudents = can("students:manage");
  const canInviteTeachers = can("teachers:manage");
  const canReports = can("reports:view");

  if (isLoading)
    return (
      <div className="space-y-4">
        <div className="skeleton h-40 rounded-3xl" />
        <div className="skeleton h-12 rounded-xl" />
      </div>
    );
  if (!circle)
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">الحَلَقة غير متاحة أو لا تملك صلاحية الوصول إليها.</p>
        <Link href="/circles" className="btn-gold mt-4 inline-flex px-4 py-2 text-sm">
          العودة للحلقات
        </Link>
      </div>
    );

  const teacher = teachers?.find(item => item.id === circle.teacherId);
  const assistant = teachers?.find(item => item.id === circle.assistantTeacherId);
  const students = (sheet.data?.students ?? []).filter(s => s.member);
  const marked = students.filter(s => s.status).length;
  const presentToday = students.filter(s => s.status === "present" || s.status === "late").length;
  const absentToday = students.filter(s => s.status === "absent").length;
  const days = history.data ?? [];
  const totals = days.reduce(
    (acc, d) => {
      acc.attended += d.present + d.late;
      acc.marked += d.present + d.late + d.absent + d.excused;
      return acc;
    },
    { attended: 0, marked: 0 }
  );
  const attendanceRate = totals.marked ? Math.round((totals.attended / totals.marked) * 100) : null;
  const recordToday = sheet.data?.record;
  const todayHref = `/daily?halaqa=${circle.id}`;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/circles">الحلقات</Link>
        <ChevronLeft className="h-4 w-4" />
        <span className="text-foreground">{circle.name}</span>
      </div>
      <section className="glass-card relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="page-title">{circle.name}</h1>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${circle.isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                >
                  {circle.isActive ? "حلقة نشطة" : "موقوفة"}
                </span>
              </div>
              <p className="page-subtitle mt-1">
                {circle.description || "مساحة تشغيلية للطلاب والسجل اليومي والإنجاز."}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                المعلم المسؤول: <span className="font-medium text-foreground">{teacher?.name || "غير محدد"}</span>
                {assistant && (
                  <span>
                    {" "}
                    · المساعد: <span className="font-medium text-foreground">{assistant.name}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={todayHref} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm">
              <ClipboardList className="h-4 w-4" />
              {recordToday ? "متابعة سجل اليوم" : "سجل اليوم"}
            </Link>
            {canReports && (
              <Link
                href={`/reports?halaqa=${circle.id}`}
                className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <FileBarChart className="h-4 w-4 text-primary" />
                التقارير
              </Link>
            )}
            {canAddStudents && (
              <Link
                href={`/students?new=1&circleId=${circle.id}`}
                className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <UserPlus className="h-4 w-4 text-primary" />
                تسجيل طالب
              </Link>
            )}
            {canInviteTeachers && (
              <Link
                href={`/teacher-invites?circleId=${circle.id}`}
                className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <UserRoundPlus className="h-4 w-4 text-primary" />
                دعوة معلم
              </Link>
            )}
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="الطلاب" value={students.length} icon={<Users className="h-4 w-4" />} />
          <Metric
            label="حضور اليوم"
            value={recordToday ? `${presentToday}/${students.length}` : "—"}
            icon={<UserRoundCheck className="h-4 w-4" />}
          />
          <Metric
            label="غياب اليوم"
            value={recordToday ? absentToday : "—"}
            icon={<UserRoundX className="h-4 w-4" />}
          />
          <Metric
            label="نسبة الحضور"
            value={attendanceRate === null ? "—" : `${attendanceRate}%`}
            icon={<CalendarCheck2 className="h-4 w-4" />}
          />
        </div>
        <div className="relative mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
            <span className="text-muted-foreground">سجل اليوم</span>
            <p className="mt-1 font-medium text-foreground">
              {recordToday
                ? `${RECORD_STATUS[recordToday.status] ?? ""} · رُصد ${marked} من ${students.length}`
                : "لم يُفتح بعد"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
            <span className="text-muted-foreground">آخر يوم مسجّل</span>
            <p className="mt-1 font-medium text-foreground">
              {days[0] ? dayLabel(days[0].date) : "لا توجد أيام مسجلة"}
            </p>
          </div>
        </div>
      </section>
      <AIGuidanceCard context="circles" />
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted/50 p-1" role="tablist">
        {tabLabels.map(tab => (
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

      {activeTab === "students" && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sheet.isLoading &&
            [1, 2].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
          {sheet.error && <Empty text={sheet.error.message} />}
          {sheet.data && !students.length && (
            <Empty text="لا يوجد طلاب في هذه الحلقة بعد." />
          )}
          {students.map(student => {
            const status = student.status ? STATUS_LABELS[student.status] : null;
            const lastMemorize = student.memorize?.segments.length
              ? segmentsText(student.memorize.segments)
              : student.last_memorize
                ? segmentsText([student.last_memorize])
                : "";
            const lastReview = student.review?.segments.length
              ? segmentsText(student.review.segments)
              : student.last_review
                ? segmentsText([student.last_review])
                : "";
            return (
              <div key={student.student_id} className="glass-card rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display font-bold text-primary">
                    {student.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/students/${student.student_id}`}
                        className="font-display text-lg font-bold text-foreground hover:text-primary"
                      >
                        {student.name}
                      </Link>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status ? status.tone : "bg-muted text-muted-foreground"}`}
                      >
                        {status ? status.label : "لم يُرصد اليوم"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      آخر حفظ: {lastMemorize || "لم يسجل بعد"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      آخر مراجعة: {lastReview || "لم تسجل بعد"}
                    </p>
                    {student.absences_30d > 0 && (
                      <p className="mt-1 text-xs text-destructive">
                        غياب آخر 30 يوماً: {student.absences_30d}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/daily?halaqa=${circle.id}&student=${student.student_id}`}
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                >
                  <ClipboardList className="h-4 w-4" />
                  تسجيل اليوم لهذا الطالب
                </Link>
              </div>
            );
          })}
        </section>
      )}

      {activeTab === "days" && (
        <section className="space-y-3">
          {history.isLoading && <div className="skeleton h-24 rounded-2xl" />}
          {history.error && <Empty text={history.error.message} />}
          {history.data && !days.length && (
            <Empty text="لا توجد أيام مسجلة بعد. افتح سجل اليوم للبدء." />
          )}
          {days.map(day => (
            <Link
              key={day.id}
              href={`/daily?halaqa=${circle.id}&date=${day.date}`}
              className="glass-card flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-muted/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{dayLabel(day.date)}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {RECORD_STATUS[day.status] ?? day.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  حضور {day.present + day.late} · غياب {day.absent} · استئذان {day.excused} · حفظ{" "}
                  {day.memorized} · مراجعة {day.reviewed}
                </p>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </section>
      )}

      {activeTab === "members" && (
        <section className="glass-card rounded-2xl p-5">
          <h2 className="font-display text-xl font-bold text-foreground">أعضاء الحَلَقة</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Member label="المعلم المسؤول" name={teacher?.name || "غير محدد"} />
            <Member label="المعلم المساعد" name={assistant?.name || "غير محدد"} />
          </div>
          {canInviteTeachers && (
            <Link
              href={`/teacher-invites?circleId=${circle.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              <UserRoundPlus className="h-4 w-4" />
              إنشاء دعوة معلم لهذه الحلقة
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/45 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
function Member({ label, name }: { label: string; name: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{name}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="glass-card col-span-full rounded-2xl py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
