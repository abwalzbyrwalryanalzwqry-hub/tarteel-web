import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  BookOpenText,
  CheckCircle,
  ChevronLeft,
  ClipboardList,
  Clock,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { AyahPicker } from "@/components/AyahPicker";
import { SessionHeaderControls } from "@/components/SessionHeaderControls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearMushafSelectionContext, createMushafSelectionToken, readMushafSelectionContext, saveMushafSelectionContext, type MushafSelectionContext } from "@/lib/mushafSelection";
import { formatHijriDate } from "../../../shared/dates";
import { getAttendanceSummary, MIZAN_RATING_LABELS, scoreToStars } from "../../../shared/mizan";
import {
  ATTENDANCE_LABELS as ATTENDANCE_STATUS_LABELS,
  GRADE_LABELS,
  QURAN_SURAHS,
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
} from "../../../shared/types";

interface Props {
  sessionId?: number;
}

function readMushafReturn(sessionId?: number) {
  const params = new URLSearchParams(window.location.search);
  const context = readMushafSelectionContext(params.get("mushafToken"));
  const toSurah = Number(params.get("toSurah"));
  const toAyah = Number(params.get("toAyah"));
  const targetSurah = QURAN_SURAHS.find((surah) => surah.number === toSurah);
  if (!context || context.sessionId !== sessionId || !targetSurah || !Number.isInteger(toAyah) || toAyah < 1 || toAyah > targetSurah.ayahs) return null;
  return { context, toSurah, toAyah };
}

const tabs = [
  { id: "attendance", label: "الحضور", icon: Users },
  { id: "memorization", label: "الحفظ", icon: BookOpen },
  { id: "revision", label: "المراجعة", icon: ClipboardList },
  { id: "evaluation", label: "التقييم", icon: Star },
];

export default function SessionDetail({ sessionId }: Props) {
  const [mushafReturn] = useState(() => readMushafReturn(sessionId));
  const [activeTab, setActiveTab] = useState(mushafReturn?.context.kind ?? "attendance");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [dialogTab, setDialogTab] = useState<"memorization" | "revision" | "evaluation">("memorization");
  const [finalizeReviewOpen, setFinalizeReviewOpen] = useState(false);
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<number, "present" | "absent" | "late" | "excused" | undefined>>({});
  const [pendingAttendanceStudentId, setPendingAttendanceStudentId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const syncSharedData = () => void Promise.all([
    utils.dashboard.stats.invalidate(),
    utils.dashboard.recentSessions.invalidate(),
    utils.students.list.invalidate(),
    utils.sessions.list.invalidate(),
    utils.circles.list.invalidate(),
  ]);

  const { data: session, isLoading: sessionLoading } = trpc.sessions.byId.useQuery(
    { id: sessionId! },
    { enabled: !!sessionId }
  );

  const { data: circle } = trpc.circles.byId.useQuery(
    { id: session?.circleId ?? 0 },
    { enabled: !!session?.circleId }
  );

  const { data: students } = trpc.students.list.useQuery(
    { circleId: session?.circleId },
    { enabled: !!session?.circleId }
  );

  const { data: latestProgress } = trpc.sessions.latestStudentProgress.useQuery(
    { circleId: session?.circleId ?? 0 },
    { enabled: !!session?.circleId }
  );

  const { data: attendance, refetch: refetchAttendance } = trpc.attendance.bySession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  const { data: memorization, refetch: refetchMemorization } = trpc.memorization.bySession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  const { data: revision, refetch: refetchRevision } = trpc.revision.bySession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  const { data: evaluation, refetch: refetchEvaluation } = trpc.evaluation.bySession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  useEffect(() => {
    if (!mushafReturn) return;
    clearMushafSelectionContext(mushafReturn.context.token);
    window.history.replaceState({}, "", `/periods/${sessionId}`);
    toast.success("تم اختيار آية النهاية من المصحف. أكمل التقدير ثم احفظ التسجيل.");
  }, [mushafReturn, sessionId]);

  useEffect(() => {
    if (!mushafReturn || mushafReturn.context.origin !== "dialog") return;
    const targetStudent = students?.find((student) => student.id === mushafReturn.context.studentId);
    if (!targetStudent) return;
    setSelectedStudent(targetStudent);
    setDialogTab(mushafReturn.context.kind);
  }, [mushafReturn, students]);

  const updateStatusMutation = trpc.sessions.updateStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث حالة الجلسة"); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });

  const finalizeMutation = trpc.sessions.finalize.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ الفترة واعتماد بياناتها في القوائم والتقارير");
      await Promise.all([utils.sessions.byId.invalidate({ id: sessionId! }), utils.sessions.list.invalidate(), utils.dashboard.stats.invalidate(), utils.dashboard.recentSessions.invalidate()]);
      syncSharedData();
    },
    onError: (error) => toast.error(error.message),
  });

  const upsertAttendanceMutation = trpc.attendance.upsert.useMutation({
    onMutate: (input) => {
      const hasLocalStatus = Object.prototype.hasOwnProperty.call(attendanceOverrides, input.studentId);
      const previous = hasLocalStatus ? attendanceOverrides[input.studentId] : attendance?.find((item) => item.studentId === input.studentId)?.status;
      setPendingAttendanceStudentId(input.studentId);
      setAttendanceOverrides((current) => ({ ...current, [input.studentId]: input.status }));
      return { previous };
    },
    onSuccess: (_result, input) => toast.success(`تم تسجيل ${ATTENDANCE_STATUS_LABELS[input.status]}`),
    onError: (error, input, context) => {
      setAttendanceOverrides((current) => ({ ...current, [input.studentId]: context?.previous }));
      toast.error(error.message);
    },
    onSettled: async (_result, _error, input) => {
      await refetchAttendance();
      setPendingAttendanceStudentId((current) => current === input.studentId ? null : current);
      syncSharedData();
    },
  });

  const markUnrecordedPresentMutation = trpc.attendance.markUnrecordedPresent.useMutation({
    onSuccess: async (result) => {
      await refetchAttendance();
      syncSharedData();
      toast.success(result.createdCount ? `سُجل الحضور لـ ${result.createdCount} من الطلاب، وحُفظت ${result.preservedCount} حالة قائمة دون تغيير` : "جميع حالات الحضور مسجلة مسبقاً، ولم تُغيّر أي حالة");
    },
    onError: (error) => toast.error(error.message),
  });

  const createMemorizationMutation = trpc.memorization.create.useMutation({
    onSuccess: () => { toast.success("تم تسجيل الحفظ"); refetchMemorization(); utils.sessions.latestStudentProgress.invalidate(); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });

  const createRevisionMutation = trpc.revision.create.useMutation({
    onSuccess: () => { toast.success("تم تسجيل المراجعة"); refetchRevision(); utils.sessions.latestStudentProgress.invalidate(); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });

  const upsertEvaluationMutation = trpc.evaluation.upsert.useMutation({
    onSuccess: () => { toast.success("تم حفظ التقييم"); refetchEvaluation(); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });

  const getSurahName = (num: number) => QURAN_SURAHS.find((s) => s.number === num)?.name ?? `سورة ${num}`;

  const getAttendanceStatus = (studentId: number) =>
    Object.prototype.hasOwnProperty.call(attendanceOverrides, studentId)
      ? attendanceOverrides[studentId]
      : attendance?.find((a) => a.studentId === studentId)?.status;

  const getStudentEvaluation = (studentId: number) =>
    evaluation?.find((e) => e.studentId === studentId);

  const attendanceStats = getAttendanceSummary(attendance ?? []);
  const totalStudents = students?.length ?? 0;
  const recordedAttendanceCount = attendance?.filter((row) => students?.some((student) => student.id === row.studentId)).length ?? 0;
  const incompleteAttendanceCount = Math.max(0, totalStudents - recordedAttendanceCount);
  const studentsWithProgress = new Set([...(memorization ?? []), ...(revision ?? [])].map((row) => row.studentId)).size;
  const studentsWithoutProgress = Math.max(0, totalStudents - studentsWithProgress);

  if (!sessionId || sessionLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">الفترة غير موجودة</p>
        <Link href="/periods"><button className="mt-4 btn-gold text-sm px-4 py-2">العودة للفترات</button></Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/periods"><span className="hover:text-foreground cursor-pointer">الفترات</span></Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="text-foreground">{session.title ?? `فترة #${session.id}`}</span>
      </div>

      {/* Session Info Card */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl font-bold text-foreground">{session.title ?? `فترة #${session.id}`}</h1>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColors[session.status]}`}>{SESSION_STATUS_LABELS[session.status]}</span>
            </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><Clock className="w-4 h-4"/>{new Date(session.scheduledAt).toLocaleDateString("ar-SA", {weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">هجري: {formatHijriDate(session.scheduledAt)}</div>
              {circle && <div className="flex items-center gap-1.5"><BookOpen className="w-4 h-4"/>{circle.name}</div>}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <SessionHeaderControls session={session} />
            {session.status === "scheduled" && (
              <button onClick={()=>updateStatusMutation.mutate({id:session.id,status:"open"})} className="btn-gold text-sm px-4 py-2">فتح الفترة</button>
            )}
            {session.status === "open" && (
              <button onClick={()=>updateStatusMutation.mutate({id:session.id,status:"closed"})} className="px-4 py-2 rounded-xl bg-gray-600 text-white text-sm hover:bg-gray-700 transition-colors">إغلاق الفترة</button>
            )}
          </div>
        </div>
        {session.status !== "closed" && session.status !== "cancelled" && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-display font-bold text-foreground">{session.status === "draft" ? "مسودة محفوظة تلقائياً" : "فترة غير معتمدة بعد"}</p><p className="mt-1 text-sm text-muted-foreground">سجّل الحضور والحفظ والمراجعة بأمان، ثم اضغط الحفظ لمراجعة البيانات قبل إضافتها إلى الفترات والتقارير.</p></div><button disabled={finalizeMutation.isPending} onClick={() => setFinalizeReviewOpen(true)} className="btn-gold shrink-0 px-5 py-3 text-sm">{finalizeMutation.isPending ? "جارٍ حفظ الفترة…" : "مراجعة وحفظ الفترة"}</button></div>}
        {session.notes && <p className="mt-3 text-sm text-muted-foreground border-t border-border/50 pt-3">{session.notes}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SessionMetric label="حاضر" value={attendanceStats.present} tone="text-emerald-700 dark:text-emerald-300" />
          <SessionMetric label="غائب" value={attendanceStats.absent} tone="text-destructive" />
          <SessionMetric label="مستأذن" value={attendanceStats.excused} tone="text-primary" />
          <SessionMetric label="متأخر" value={attendanceStats.late} tone="text-amber-600 dark:text-amber-300" />
        </div>
      </div>

      <AIGuidanceCard context="sessions" />

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "attendance" && (
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-foreground">تسجيل الحضور</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">سُجل حضور {recordedAttendanceCount} من {totalStudents} · وسُجل إنجاز لـ {studentsWithProgress} من الطلاب. سجّل الجميع حضوراً مرة واحدة؛ ستبقى حالات الغياب والاستئذان المسجلة يدوياً كما هي.</p></div>{students && students.length > 0 && <button type="button" disabled={markUnrecordedPresentMutation.isPending} onClick={() => markUnrecordedPresentMutation.mutate({ sessionId: session.id })} className="rounded-xl border border-emerald-600/25 bg-emerald-600/10 px-3 py-2 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-600/15 disabled:cursor-wait disabled:opacity-70 dark:text-emerald-200">{markUnrecordedPresentMutation.isPending ? "جارٍ تسجيل الحضور…" : "تسجيل الجميع حضوراً"}</button>}</div>
          {!students || students.length === 0 ? (
            <div className="text-center py-8"><Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3"/><p className="text-muted-foreground text-sm">لا يوجد طلاب في هذه الحلقة</p></div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const status = getAttendanceStatus(student.id);
                return (
                  <div key={student.id} role="button" tabIndex={0} onClick={() => setSelectedStudent(student)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedStudent(student); } }} className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/45 p-3 text-right transition-all hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                    <div className="w-9 h-9 rounded-full bg-emerald-600/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-emerald-600 text-sm">{student.name.charAt(0)}</span>
                    </div>
                    <span className="flex-1 font-medium text-foreground">{student.name}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">انقر لتسجيل الحفظ والمراجعة</span>
                    <div className="flex gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {(["present","absent","excused"] as const).map((s) => (
                        <button
                          key={s}
                          aria-label={ATTENDANCE_STATUS_LABELS[s]}
                          aria-pressed={status === s}
                          title={ATTENDANCE_STATUS_LABELS[s]}
                          type="button"
                          disabled={pendingAttendanceStudentId === student.id}
                          onClick={() => upsertAttendanceMutation.mutate({ sessionId: session.id, studentId: student.id, status: s })}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:cursor-wait disabled:opacity-70 ${
                            status === s
                              ? s === "present" ? "bg-emerald-600 text-white border-emerald-600"
                              : s === "absent" ? "bg-red-600 text-white border-red-600"
                              : "bg-blue-600 text-white border-blue-600"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {s === "present" ? <CheckCircle className="h-4 w-4" /> : s === "absent" ? <XCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "memorization" && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-display font-bold text-foreground text-lg mb-4">تسجيل الحفظ الجديد</h2>
            {!students || students.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">لا يوجد طلاب في هذه الحلقة</p>
            ) : (
              <div className="space-y-4">
                {students.map((student) => (
                  <MemorizationForm
                    key={student.id}
                    student={student}
                    sessionId={session.id}
                    progress={latestProgress?.[student.id]}
                    onSubmit={(data: any) => createMemorizationMutation.mutate(data)}
                    isLoading={createMemorizationMutation.isPending}
                    returnContext={mushafReturn?.context.kind === "memorization" && mushafReturn.context.origin !== "dialog" && mushafReturn.context.studentId === student.id ? mushafReturn : undefined}
                  />
                ))}
              </div>
            )}
          </div>
          {memorization && memorization.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3">سجل الحفظ في هذه الجلسة</h3>
              <div className="space-y-2">
                {memorization.map((m) => {
                  const student = students?.find(s => s.id === m.studentId);
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <BookOpen className="w-4 h-4 text-primary flex-shrink-0"/>
                      <span className="font-medium text-foreground">{student?.name}</span>
                      <span className="text-sm text-muted-foreground">{getSurahName(m.surahNumber)} {m.toSurahNumber && m.toSurahNumber !== m.surahNumber ? `إلى ${getSurahName(m.toSurahNumber)}` : ""} ({m.fromAyah}-{m.toAyah})</span>
                      <Link href={`/quran?surah=${m.surahNumber}&ayah=${m.fromAyah}`}><span className="text-xs text-primary hover:underline cursor-pointer">فتح المرجع</span></Link>
                      {m.grade && <span className={`mr-auto text-xs px-2 py-0.5 rounded-full ${m.grade==="excellent"?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":m.grade==="very_good"?"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400":"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>{GRADE_LABELS[m.grade]}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "revision" && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-display font-bold text-foreground text-lg mb-4">تسجيل المراجعة</h2>
            {!students || students.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">لا يوجد طلاب في هذه الحلقة</p>
            ) : (
              <div className="space-y-4">
                {students.map((student) => (
                  <RevisionForm
                    key={student.id}
                    student={student}
                    sessionId={session.id}
                    progress={latestProgress?.[student.id]}
                    onSubmit={(data: any) => createRevisionMutation.mutate(data)}
                    isLoading={createRevisionMutation.isPending}
                    returnContext={mushafReturn?.context.kind === "revision" && mushafReturn.context.origin !== "dialog" && mushafReturn.context.studentId === student.id ? mushafReturn : undefined}
                  />
                ))}
              </div>
            )}
          </div>
          {revision && revision.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3">سجل المراجعة في هذه الجلسة</h3>
              <div className="space-y-2">
                {revision.map((r) => {
                  const student = students?.find(s => s.id === r.studentId);
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <ClipboardList className="w-4 h-4 text-purple-600 flex-shrink-0"/>
                      <span className="font-medium text-foreground">{student?.name}</span>
                      <span className="text-sm text-muted-foreground">{getSurahName(r.surahNumber)} {r.toSurahNumber && r.toSurahNumber !== r.surahNumber ? `إلى ${getSurahName(r.toSurahNumber)}` : ""} ({r.fromAyah}-{r.toAyah})</span>
                      <Link href={`/quran?surah=${r.surahNumber}&ayah=${r.fromAyah}`}><span className="text-xs text-primary hover:underline cursor-pointer">فتح المرجع</span></Link>
                      {r.grade && <span className={`mr-auto text-xs px-2 py-0.5 rounded-full ${r.grade==="excellent"?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>{GRADE_LABELS[r.grade]}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "evaluation" && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4">تقييم الطلاب</h2>
          {!students || students.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">لا يوجد طلاب في هذه الحلقة</p>
          ) : (
            <div className="space-y-4">
              {students.map((student) => {
                const ev = getStudentEvaluation(student.id);
                return (
                  <EvaluationForm
                    key={student.id}
                    student={student}
                    sessionId={session.id}
                    existing={ev}
                    onSubmit={(data: any) => upsertEvaluationMutation.mutate(data)}
                    isLoading={upsertEvaluationMutation.isPending}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl" dir="rtl">
          <DialogHeader><DialogTitle className="font-display text-xl">سجل الطالب في الجلسة</DialogTitle><DialogDescription>سجّل الحفظ أو المراجعة أو التقييم، ثم افتح موضع البداية في المصحف عند الحاجة.</DialogDescription></DialogHeader>
          {selectedStudent && <div className="space-y-4"><div className="rounded-2xl bg-primary/5 p-3"><p className="font-semibold text-foreground">{selectedStudent.name}</p><p className="mt-1 text-xs text-muted-foreground">آخر حفظ: {getSurahName(latestProgress?.[selectedStudent.id]?.memorization?.toSurahNumber ?? latestProgress?.[selectedStudent.id]?.memorization?.surahNumber ?? selectedStudent.lastMemorizedSurah)} · آية {latestProgress?.[selectedStudent.id]?.memorization?.toAyah ?? selectedStudent.lastMemorizedAyah}</p><p className="mt-1 text-xs text-muted-foreground">آخر مراجعة: {latestProgress?.[selectedStudent.id]?.revision ? `${getSurahName(latestProgress?.[selectedStudent.id]?.revision?.toSurahNumber ?? latestProgress?.[selectedStudent.id]?.revision?.surahNumber ?? 1)} · آية ${latestProgress?.[selectedStudent.id]?.revision?.toAyah ?? 1}` : "لم تسجل بعد"}</p></div><div className="flex gap-1 rounded-xl bg-muted/50 p-1">{([ ["memorization", "الحفظ"], ["revision", "المراجعة"], ["evaluation", "التقييم"] ] as const).map(([id, label]) => <button key={id} onClick={() => setDialogTab(id)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${dialogTab === id ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}</div>{dialogTab === "memorization" && <MemorizationForm student={selectedStudent} sessionId={session.id} progress={latestProgress?.[selectedStudent.id]} onSubmit={(data: any) => createMemorizationMutation.mutate(data)} isLoading={createMemorizationMutation.isPending} forceExpanded returnContext={mushafReturn?.context.kind === "memorization" && mushafReturn.context.origin === "dialog" && mushafReturn.context.studentId === selectedStudent.id ? mushafReturn : undefined} />}{dialogTab === "revision" && <RevisionForm student={selectedStudent} sessionId={session.id} progress={latestProgress?.[selectedStudent.id]} onSubmit={(data: any) => createRevisionMutation.mutate(data)} isLoading={createRevisionMutation.isPending} forceExpanded returnContext={mushafReturn?.context.kind === "revision" && mushafReturn.context.origin === "dialog" && mushafReturn.context.studentId === selectedStudent.id ? mushafReturn : undefined} />}{dialogTab === "evaluation" && <EvaluationForm student={selectedStudent} sessionId={session.id} existing={getStudentEvaluation(selectedStudent.id)} onSubmit={(data: any) => upsertEvaluationMutation.mutate(data)} isLoading={upsertEvaluationMutation.isPending} forceExpanded />}</div>}
        </DialogContent>
      </Dialog>
      <Dialog open={finalizeReviewOpen} onOpenChange={setFinalizeReviewOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">مراجعة اعتماد الفترة</DialogTitle>
            <DialogDescription>بعد الاعتماد تظهر بيانات الفترة في القوائم والتقارير ولا تعود مسودة.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted p-3"><p className="font-display text-xl font-bold text-foreground">{totalStudents}</p><p className="mt-1 text-xs text-muted-foreground">طلاب الحلقة</p></div>
            <div className="rounded-xl bg-primary/10 p-3"><p className="font-display text-xl font-bold text-primary">{recordedAttendanceCount}</p><p className="mt-1 text-xs text-muted-foreground">حالات حضور</p></div>
            <div className="rounded-xl bg-emerald-500/10 p-3"><p className="font-display text-xl font-bold text-emerald-700 dark:text-emerald-300">{studentsWithProgress}</p><p className="mt-1 text-xs text-muted-foreground">لهم إنجاز</p></div>
          </div>
          {totalStudents === 0 ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-foreground">لا يوجد طلاب في هذه الحلقة. راجع الحلقة قبل اعتماد فترة بلا سجلات طلاب.</p> : incompleteAttendanceCount > 0 ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-foreground">لم تسجل حالة حضور لـ {incompleteAttendanceCount} {incompleteAttendanceCount === 1 ? "طالب" : "طلاب"}. يمكنك العودة لإكمالها أو الاعتماد إذا كان ذلك مقصوداً.</p> : <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-foreground">سجلت حالة حضور لجميع طلاب الحلقة.</p>}
          {totalStudents > 0 && studentsWithoutProgress > 0 && <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-foreground">تنبيه متابعة: لا يوجد حفظ أو مراجعة مسجل لـ {studentsWithoutProgress} {studentsWithoutProgress === 1 ? "طالب" : "طلاب"} في هذه الفترة. هذا لا يمنع الاعتماد؛ راجعه فقط إذا كانت الفترة مخصصة للحفظ أو المراجعة.</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFinalizeReviewOpen(false)} className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">العودة للتسجيل</button>
            <button type="button" disabled={finalizeMutation.isPending} onClick={() => { setFinalizeReviewOpen(false); finalizeMutation.mutate({ id: session.id }); }} className="btn-gold px-4 py-2.5 text-sm">{finalizeMutation.isPending ? "جارٍ الحفظ…" : "اعتماد الفترة"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2"><p className={`font-display text-lg font-bold ${tone}`}>{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

function MemorizationForm(props: any) { return <QuranEntryForm {...props} kind="memorization" />; }
function RevisionForm(props: any) { return <QuranEntryForm {...props} kind="revision" />; }

function QuranEntryForm({ student, sessionId, progress, onSubmit, isLoading, kind, forceExpanded = false, returnContext }: any) {
  const [expanded, setExpanded] = useState(false);
  const isMemorization = kind === "memorization";
  const remembered = isMemorization ? progress?.memorization : progress?.revision;
  const initialSurah = remembered?.toSurahNumber ?? remembered?.surahNumber ?? student.lastMemorizedSurah ?? 1;
  const initialAyah = remembered?.toAyah ?? student.lastMemorizedAyah ?? 1;
  const [fromSurah, setFromSurah] = useState(() => initialSurah);
  const [toSurah, setToSurah] = useState(() => initialSurah);
  const [fromAyah, setFromAyah] = useState(() => initialAyah);
  const [toAyah, setToAyah] = useState(() => initialAyah);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!remembered) return;
    const resumedSurah = remembered.toSurahNumber ?? remembered.surahNumber;
    const resumedAyah = remembered.toAyah;
    setFromSurah(resumedSurah);
    setToSurah(resumedSurah);
    setFromAyah(resumedAyah);
    setToAyah(resumedAyah);
  }, [remembered?.id]);
  useEffect(() => {
    if (!returnContext) return;
    setExpanded(true);
    setToSurah(returnContext.toSurah);
    setToAyah(returnContext.toAyah);
  }, [returnContext]);
  const fromMax = QURAN_SURAHS.find((surah) => surah.number === fromSurah)?.ayahs ?? 1;
  const toMax = QURAN_SURAHS.find((surah) => surah.number === toSurah)?.ayahs ?? 1;
  const label = isMemorization ? "الحفظ" : "المراجعة";
  const accent = isMemorization ? "bg-emerald-600/10 text-emerald-600" : "bg-purple-600/10 text-purple-600";
  const selectSurah = (value: number, side: "from" | "to") => { if (side === "from") { setFromSurah(value); setFromAyah(1); setToSurah(value); setToAyah(1); } else { setToSurah(value); setToAyah(1); } };
  const openMushaf = () => {
    const fields = formRef.current ? new FormData(formRef.current) : new FormData();
    const token = createMushafSelectionToken();
    const context: MushafSelectionContext = { token, returnPath: `/periods/${sessionId}`, sessionId, studentId: student.id, kind, origin: forceExpanded ? "dialog" : "inline", fromSurah, fromAyah, toSurah, toAyah, pages: String(fields.get("pages") ?? ""), grade: String(fields.get("grade") ?? ""), notes: String(fields.get("notes") ?? ""), createdAt: Date.now() };
    saveMushafSelectionContext(context);
    window.location.assign(`/quran/picker?surah=${fromSurah}&ayah=${fromAyah}&mushafToken=${encodeURIComponent(token)}`);
  };
  const showForm = expanded || forceExpanded;
  return <div className="overflow-hidden rounded-xl border border-border/50">{!forceExpanded && <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-3 p-3 text-right transition-colors hover:bg-muted/30"><div className={`flex h-8 w-8 items-center justify-center rounded-full ${accent}`}><span className="text-sm font-bold">{student.name.charAt(0)}</span></div><span className="flex-1 font-medium text-foreground">{student.name}</span><span className="text-xs text-muted-foreground">{expanded ? "إخفاء" : `تسجيل ${label}`}</span></button>}{showForm && <form ref={formRef} onSubmit={(event) => { event.preventDefault(); if (toSurah === fromSurah && toAyah < fromAyah) { toast.error("داخل السورة نفسها يجب أن تكون آية النهاية بعد آية البداية"); return; } onSubmit({ sessionId, studentId: student.id, surahNumber: fromSurah, toSurahNumber: toSurah, fromAyah, toAyah, pages: (new FormData(event.currentTarget).get("pages") as string) || undefined, grade: (new FormData(event.currentTarget).get("grade") as string) || undefined, notes: (new FormData(event.currentTarget).get("notes") as string) || undefined }); if (!forceExpanded) setExpanded(false); }} className="space-y-3 border-t border-border/50 p-3 pt-3"><div className="grid grid-cols-2 gap-2"><FieldSelect label="من سورة" value={fromSurah} onChange={(value) => selectSurah(value, "from")} /><FieldSelect label="إلى سورة" value={toSurah} onChange={(value) => selectSurah(value, "to")} /><AyahPicker label="من آية" value={fromAyah} max={fromMax} onChange={setFromAyah} /><AyahPicker label="إلى آية" value={toAyah} max={toMax} onChange={setToAyah} /></div><button type="button" onClick={openMushaf} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/5 py-2 text-sm font-semibold text-primary hover:bg-primary/10"><BookOpenText className="h-4 w-4" />فتح موضع البداية في المصحف المرئي</button><div className="grid grid-cols-3 gap-2"><div><label className="mb-1 block text-xs text-muted-foreground">الصفحات</label><input name="pages" defaultValue={returnContext?.context.pages} type="number" min="0" step="0.5" className="tarteel-input py-1.5 text-sm" placeholder="0" /></div><div><label className="mb-1 block text-xs text-muted-foreground">التقدير</label><select name="grade" defaultValue={returnContext?.context.grade} className="tarteel-input py-1.5 text-sm"><option value="">اختر</option>{Object.entries(GRADE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div><div><label className="mb-1 block text-xs text-muted-foreground">ملاحظات</label><input name="notes" defaultValue={returnContext?.context.notes} className="tarteel-input py-1.5 text-sm" placeholder="اختياري" /></div></div><button type="submit" disabled={isLoading} className="btn-gold w-full py-2 text-sm">{isLoading ? "جارٍ الحفظ..." : `تسجيل ${label}`}</button></form>}</div>;
}

function FieldSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <div><label className="mb-1 block text-xs text-muted-foreground">{label}</label><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="tarteel-input py-1.5 text-sm">{QURAN_SURAHS.map((surah) => <option key={surah.number} value={surah.number}>{surah.number}. {surah.name}</option>)}</select></div>; }

function EvaluationForm({ student, sessionId, existing, onSubmit, isLoading, forceExpanded = false }: any) {
  const [expanded, setExpanded] = useState(false);
  const [stars, setStars] = useState(() => scoreToStars(existing?.totalScore));
  const showForm = expanded || forceExpanded;
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      {!forceExpanded && <button onClick={()=>setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-right">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><span className="font-bold text-amber-600 text-sm">{student.name.charAt(0)}</span></div>
        <span className="font-medium text-foreground flex-1">{student.name}</span>
        {existing?.totalScore != null && <span className="text-sm font-bold text-primary">{existing.totalScore}/100</span>}
        <span className="text-xs text-muted-foreground">{expanded?"إخفاء":"تقييم"}</span>
      </button>}
      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); const fd=new FormData(e.currentTarget); onSubmit({sessionId,studentId:student.id,tajweedScore:Number(fd.get("tajweedScore"))||undefined,pronunciationScore:Number(fd.get("pronunciationScore"))||undefined,memorizationScore:Number(fd.get("memorizationScore"))||undefined,behaviorScore:Number(fd.get("behaviorScore"))||undefined,totalScore:stars ? stars * 20 : (Number(fd.get("totalScore")) || undefined),notes:fd.get("notes")||undefined}); if (!forceExpanded) setExpanded(false); }} className="p-3 pt-0 space-y-3 border-t border-border/50">
          <div className="rounded-xl bg-primary/5 p-3 text-center"><p className="text-xs text-muted-foreground">التقييم العام</p><div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="تقييم من خمس نجوم">{[1,2,3,4,5].map((star) => <button key={star} type="button" onClick={() => setStars(star)} className={`rounded-md p-1 transition-transform hover:scale-110 ${star <= stars ? "text-primary" : "text-muted-foreground/35"}`} aria-label={`${star} نجوم`}><Star className="h-6 w-6" fill="currentColor" /></button>)}</div><p className="mt-1 text-sm font-semibold text-primary">{MIZAN_RATING_LABELS[stars]} {stars ? `· ${stars}/5` : ""}</p></div>
          <div className="grid grid-cols-2 gap-2">
            {[{name:"tajweedScore",label:"التجويد"},{name:"pronunciationScore",label:"النطق"},{name:"memorizationScore",label:"الحفظ"},{name:"behaviorScore",label:"السلوك"}].map(f=>(
              <div key={f.name}><label className="block text-xs text-muted-foreground mb-1">{f.label} (0-100)</label><input name={f.name} type="number" min={0} max={100} defaultValue={existing?.[f.name]??""} className="tarteel-input text-sm py-1.5"/></div>
            ))}
          </div>
          <div><label className="block text-xs text-muted-foreground mb-1">المجموع الكلي</label><input name="totalScore" type="number" min={0} max={100} defaultValue={existing?.totalScore??""} className="tarteel-input text-sm py-1.5"/></div>
          <div><label className="block text-xs text-muted-foreground mb-1">ملاحظات</label><textarea name="notes" rows={2} defaultValue={existing?.notes??""} className="tarteel-input text-sm resize-none"/></div>
          <button type="submit" disabled={isLoading} className="btn-gold w-full text-sm py-2">{isLoading?"جارٍ الحفظ...":"حفظ التقييم"}</button>
        </form>
      )}
    </div>
  );
}
