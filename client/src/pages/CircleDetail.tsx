import { NewSessionComposer, type NewSessionValues } from "@/components/NewSessionComposer";
import { trpc } from "@/lib/trpc";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { BookOpen, CalendarClock, ChevronLeft, Clock3, Copy, FileBarChart, Plus, Users, UserRoundCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { QURAN_SURAHS, SESSION_STATUS_LABELS } from "../../../shared/types";
import { formatHijriDate } from "../../../shared/dates";
import { usePermissions } from "@/hooks/usePermissions";

type Props = { circleId?: number };
type TabId = "students" | "members" | "periods" | "record";

const tabLabels: { id: TabId; label: string }[] = [
  { id: "students", label: "الطلاب" },
  { id: "members", label: "الأعضاء" },
  { id: "periods", label: "الفترات" },
  { id: "record", label: "السجل الشهري" },
];

function surahName(number?: number | null) {
  return QURAN_SURAHS.find((surah) => surah.number === number)?.name ?? "—";
}

export default function CircleDetail({ circleId }: Props) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("students");
  const [showPeriodComposer, setShowPeriodComposer] = useState(false);
  const [periodConflict, setPeriodConflict] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const dateFilter = useMemo(() => ({ startDate: start ? new Date(`${start}T00:00:00`) : undefined, endDate: end ? new Date(`${end}T23:59:59`) : undefined }), [start, end]);

  const { data: circle, isLoading } = trpc.circles.byId.useQuery({ id: circleId ?? 0 }, { enabled: Boolean(circleId) });
  const { data: students } = trpc.students.list.useQuery({ circleId }, { enabled: Boolean(circleId) });
  const { data: sessions } = trpc.sessions.list.useQuery({ circleId }, { enabled: Boolean(circleId) });
  const { data: teachers } = trpc.teachers.list.useQuery({ centerId: undefined });
  const { data: seasons } = trpc.seasons.list.useQuery({ centerId: undefined });
  const { data: monthlyRecord, refetch: refetchRecord } = trpc.mizan.monthlyRecord.useQuery({ circleId: circleId ?? 0, ...dateFilter }, { enabled: Boolean(circleId) });
  const activeSessionId = useMemo(() => (sessions ?? []).find((session) => session.status === "open")?.id, [sessions]);
  const { data: activeAttendance } = trpc.attendance.bySession.useQuery({ sessionId: activeSessionId ?? 0 }, { enabled: Boolean(activeSessionId) });
  const utils = trpc.useUtils();
  const { can, role } = usePermissions();
  const canManageCircleWork = can("sessions:manage");
  const isTeachingRole = role === "teacher" || role === "assistant_teacher";

  const createPeriod = trpc.sessions.create.useMutation({
    onSuccess: async (result, values) => {
      let periodId = Number(result?.periodId ?? result?.sessionId);
      if (!Number.isInteger(periodId) || periodId < 1) {
        const created = await utils.sessions.byDay.fetch({ circleId: values.circleId, scheduledAt: values.scheduledAt });
        periodId = Number(created?.id);
      }
      if (!Number.isInteger(periodId) || periodId < 1) { toast.error("تم حفظ المسودة، لكن تعذر فتح سجل طلابها. افتحها من قسم المسودات المحفوظة."); return; }
      toast.success("تم إنشاء الفترة بنجاح");
      setPeriodConflict(null);
      setShowPeriodComposer(false);
      navigate(`/periods/${periodId}`, { replace: true });
      void Promise.all([utils.sessions.list.invalidate(), utils.dashboard.stats.invalidate(), utils.dashboard.recentSessions.invalidate(), utils.circles.list.invalidate()]);
      refetchRecord();
    },
    onError: (error) => { setPeriodConflict(error.message); toast.error(error.message); },
  });
  const quickAttendance = trpc.attendance.upsert.useMutation({
    onMutate: async (input) => {
      await utils.attendance.bySession.cancel({ sessionId: input.sessionId });
      const previous = utils.attendance.bySession.getData({ sessionId: input.sessionId });
      utils.attendance.bySession.setData({ sessionId: input.sessionId }, (rows) => {
        const next = rows ? [...rows] : [];
        const index = next.findIndex((row) => row.studentId === input.studentId);
        const record = { id: next[index]?.id ?? -input.studentId, sessionId: input.sessionId, studentId: input.studentId, status: input.status, notes: null, recordedBy: null, createdAt: new Date(), updatedAt: new Date() };
        if (index >= 0) next[index] = { ...next[index], ...record }; else next.push(record as any);
        return next;
      });
      return { previous };
    },
    onError: (error, input, context) => { utils.attendance.bySession.setData({ sessionId: input.sessionId }, context?.previous); toast.error(error.message); },
    onSuccess: () => { toast.success("تم تحديث الحضور"); refetchRecord(); },
    onSettled: (_data, _error, input) => utils.attendance.bySession.invalidate({ sessionId: input.sessionId }),
  });

  if (isLoading) return <div className="space-y-4"><div className="skeleton h-40 rounded-3xl" /><div className="skeleton h-12 rounded-xl" /></div>;
  if (!circle) return <div className="py-16 text-center"><p className="text-muted-foreground">الحَلَقة غير متاحة أو لا تملك صلاحية الوصول إليها.</p><Link href="/circles" className="btn-gold mt-4 inline-flex px-4 py-2 text-sm">العودة للحلقات</Link></div>;

  const teacher = teachers?.find((item) => item.id === circle.teacherId);
  const assistant = teachers?.find((item) => item.id === circle.assistantTeacherId);
  const orderedSessions = [...(sessions ?? [])].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  const lastSession = orderedSessions.find((item) => new Date(item.scheduledAt).getTime() <= Date.now());
  const nextSession = [...(sessions ?? [])].filter((item) => new Date(item.scheduledAt).getTime() > Date.now()).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  const present = monthlyRecord?.reduce((sum, item) => sum + item.present, 0) ?? 0;
  const absent = monthlyRecord?.reduce((sum, item) => sum + item.absent, 0) ?? 0;

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(`${window.location.origin}/teacher-invites`);
    toast.success("تم نسخ مسار إدارة دعوات المعلّمين");
  };

  return <div className="space-y-6" dir="rtl">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Link href="/circles">الحلقات</Link><ChevronLeft className="h-4 w-4" /><span className="text-foreground">{circle.name}</span></div>
    <section className="glass-card relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><BookOpen className="h-7 w-7" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="page-title">{circle.name}</h1><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${circle.isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{circle.isActive ? "حلقة نشطة" : "موقوفة"}</span></div><p className="page-subtitle mt-1">{circle.description || "مساحة تشغيلية لإدارة الطلاب والفترات والإنجاز."}</p><p className="mt-3 text-sm text-muted-foreground">المعلم المسؤول: <span className="font-medium text-foreground">{teacher?.name || "غير محدد"}</span>{assistant && <span> · المساعد: <span className="font-medium text-foreground">{assistant.name}</span></span>}</p></div></div>
        <div className="flex flex-wrap gap-2">{canManageCircleWork && <button onClick={() => setActiveTab("periods")} className="rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"><CalendarClock className="ml-1 inline h-4 w-4 text-primary" />الفترات</button>}<button onClick={copyInvite} className="rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"><Copy className="ml-1 inline h-4 w-4 text-primary" />دعوة</button></div>
      </div>
      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="الطلاب" value={students?.length ?? 0} icon={<Users className="h-4 w-4" />} /><Metric label="حضور الفترات" value={present} icon={<UserRoundCheck className="h-4 w-4" />} /><Metric label="غياب الفترات" value={absent} icon={<Clock3 className="h-4 w-4" />} /><Metric label="الفترات" value={sessions?.length ?? 0} icon={<CalendarClock className="h-4 w-4" />} /></div>
      <div className="relative mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-2xl border border-border/60 bg-background/40 p-3"><span className="text-muted-foreground">آخر فترة</span><p className="mt-1 font-medium text-foreground">{lastSession ? new Date(lastSession.scheduledAt).toLocaleDateString("ar-SA") : "لا توجد فترات مكتملة"}</p></div><div className="rounded-2xl border border-border/60 bg-background/40 p-3"><span className="text-muted-foreground">الفترة القادمة</span><p className="mt-1 font-medium text-foreground">{nextSession ? new Date(nextSession.scheduledAt).toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric" }) : "لا توجد فترة مجدولة"}</p></div></div>
    </section>
    <AIGuidanceCard context="circles" />
    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted/50 p-1">{tabLabels.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>)}</div>

    {activeTab === "students" && <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">{(monthlyRecord ?? []).map((item) => <StudentMizanCard key={item.student.id} record={item} activeSessionId={activeSessionId} attendanceStatus={activeAttendance?.find((row) => row.studentId === item.student.id)?.status} onAttendance={(status) => activeSessionId && quickAttendance.mutate({ sessionId: activeSessionId, studentId: item.student.id, status })} isUpdating={quickAttendance.isPending} />)}{!monthlyRecord?.length && <Empty text="لا يوجد طلاب مسجلون في هذه الحَلَقة." />}{monthlyRecord?.length && !activeSessionId && <p className="col-span-full rounded-2xl border border-primary/15 bg-primary/5 p-3 text-center text-sm text-primary">افتح فترة الحَلَقة لتفعيل إجراءات الحضور السريعة للطلاب.</p>}</section>}
    {activeTab === "members" && <section className="glass-card rounded-2xl p-5"><h2 className="font-display text-xl font-bold text-foreground">أعضاء الحَلَقة</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Member label="المعلم المسؤول" name={teacher?.name || "غير محدد"} /><Member label="المعلم المساعد" name={assistant?.name || "غير محدد"} /></div><p className="mt-4 text-sm text-muted-foreground">إدارة الانضمام وربط المعلمين متاحة من قسم دعوات المعلمين.</p></section>}
    {activeTab === "periods" && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-foreground">فترات الحَلَقة</h2><p className="text-sm text-muted-foreground">كل فترة هي سجل عمل مستقل للحضور والحفظ والمراجعة والتقييم.</p></div>{canManageCircleWork && <button onClick={() => setShowPeriodComposer(true)} className="btn-gold px-4 py-2 text-sm"><Plus className="ml-1 inline h-4 w-4" />فترة جديدة</button>}</div><div className="grid gap-3 md:grid-cols-2">{orderedSessions.map((period) => <Link key={period.id} href={`/periods/${period.id}`} className="block glass-card rounded-2xl p-4 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between gap-3"><div><p className="font-display text-lg font-bold text-foreground">{period.title || "فترة الحَلَقة"}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(period.scheduledAt).toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {formatHijriDate(period.scheduledAt)}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{SESSION_STATUS_LABELS[period.status]}</span></div></Link>)}{!orderedSessions.length && <Empty text="لم تُنشأ فترات لهذه الحَلَقة بعد." />}</div></section>}
    {activeTab === "record" && <section className="space-y-4"><div className="glass-card rounded-2xl p-4"><div className="flex flex-col gap-3 md:flex-row md:items-end"><label className="flex-1 text-sm font-medium text-foreground">من تاريخ<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="tarteel-input mt-1" /></label><label className="flex-1 text-sm font-medium text-foreground">إلى تاريخ<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="tarteel-input mt-1" /></label><button onClick={() => refetchRecord()} className="btn-gold px-4 py-2 text-sm"><FileBarChart className="ml-1 inline h-4 w-4" />تحديث السجل</button></div></div><div className="overflow-x-auto glass-card rounded-2xl"><table className="min-w-[760px] w-full text-right text-sm"><thead className="border-b border-border bg-muted/40 text-muted-foreground"><tr><th className="p-3">الطالب</th><th className="p-3">حضور</th><th className="p-3">غياب</th><th className="p-3">استئذان</th><th className="p-3">تأخر</th><th className="p-3">صفحات حفظ</th><th className="p-3">صفحات مراجعة</th></tr></thead><tbody>{monthlyRecord?.map((item) => <tr key={item.student.id} className="border-b border-border/50 last:border-0"><td className="p-3 font-medium text-foreground">{item.student.name}</td><td className="p-3 text-emerald-700">{item.present}</td><td className="p-3 text-destructive">{item.absent}</td><td className="p-3 text-primary">{item.excused}</td><td className="p-3 text-amber-600">{item.late}</td><td className="p-3">{item.memorizedPages}</td><td className="p-3">{item.reviewedPages}</td></tr>)}</tbody></table></div></section>}
    <NewSessionComposer open={showPeriodComposer} onOpenChange={(open) => { setShowPeriodComposer(open); if (!open) setPeriodConflict(null); }} circles={[circle]} teachers={teachers} seasons={seasons} isTeachingRole={isTeachingRole} isLoading={createPeriod.isPending} conflictMessage={periodConflict} onClearConflict={() => setPeriodConflict(null)} onSubmit={(values: NewSessionValues) => { setPeriodConflict(null); createPeriod.mutate(values); }} />
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="rounded-2xl border border-border/60 bg-background/45 p-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div><p className="mt-1 font-display text-xl font-bold text-foreground">{value}</p></div>; }
function Member({ label, name }: { label: string; name: string }) { return <div className="rounded-xl border border-border/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold text-foreground">{name}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="glass-card col-span-full rounded-2xl py-10 text-center text-sm text-muted-foreground">{text}</div>; }
function StudentMizanCard({ record, activeSessionId, attendanceStatus, onAttendance, isUpdating }: { record: any; activeSessionId?: number; attendanceStatus?: string; onAttendance: (status: "present" | "absent" | "late" | "excused") => void; isUpdating: boolean }) { const { student } = record; const actions: { status: "present" | "absent" | "late" | "excused"; label: string; active: string }[] = [{ status: "present", label: "حاضر", active: "bg-emerald-600 text-white" }, { status: "absent", label: "غائب", active: "bg-destructive text-destructive-foreground" }, { status: "late", label: "متأخر", active: "bg-amber-500 text-white" }, { status: "excused", label: "مستأذن", active: "bg-primary text-primary-foreground" }]; return <div className="glass-card rounded-2xl p-4"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display font-bold text-primary">{student.name.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><Link href={`/students/${student.id}`} className="font-display text-lg font-bold text-foreground hover:text-primary">{student.name}</Link><span className={`rounded-full px-2 py-0.5 text-xs ${student.isActive ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{student.isActive ? "نشط" : "موقوف"}</span></div><p className="mt-1 text-xs text-muted-foreground">آخر حفظ: {record.lastMemorization ? `${surahName(record.lastMemorization.surahNumber)} · آية ${record.lastMemorization.toAyah}` : "لم يسجل بعد"}</p><p className="mt-1 text-xs text-muted-foreground">آخر مراجعة: {record.lastRevision ? `${surahName(record.lastRevision.surahNumber)} · آية ${record.lastRevision.toAyah}` : "لم تسجل بعد"}</p></div></div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><Mini label="حضور" value={record.present} tone="text-emerald-700" /><Mini label="غياب" value={record.absent} tone="text-destructive" /><Mini label="استئذان" value={record.excused} tone="text-primary" /><Mini label="تأخر" value={record.late} tone="text-amber-600" /></div><div className="mt-4 border-t border-border/50 pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">حضور الفترة المفتوحة</p><div className="grid grid-cols-4 gap-2">{actions.map((action) => <button key={action.status} disabled={!activeSessionId || isUpdating} onClick={() => onAttendance(action.status)} className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${attendanceStatus === action.status ? action.active : "border-border bg-background/60 text-muted-foreground hover:bg-muted"}`}>{action.label}</button>)}</div></div></div>; }
function Mini({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="rounded-xl bg-muted/40 px-1 py-2"><p className={`font-bold ${tone}`}>{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>; }
