import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ClipboardList,
  Clock,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { formatHijriDate } from "../../../shared/dates";
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

const tabs = [
  { id: "attendance", label: "الحضور", icon: Users },
  { id: "memorization", label: "الحفظ", icon: BookOpen },
  { id: "revision", label: "المراجعة", icon: ClipboardList },
  { id: "evaluation", label: "التقييم", icon: Star },
];

export default function SessionDetail({ sessionId }: Props) {
  const [activeTab, setActiveTab] = useState("attendance");

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

  const updateStatusMutation = trpc.sessions.updateStatus.useMutation({
    onSuccess: () => toast.success("تم تحديث حالة الجلسة"),
    onError: (e) => toast.error(e.message),
  });

  const upsertAttendanceMutation = trpc.attendance.upsert.useMutation({
    onSuccess: () => refetchAttendance(),
    onError: (e) => toast.error(e.message),
  });

  const createMemorizationMutation = trpc.memorization.create.useMutation({
    onSuccess: () => { toast.success("تم تسجيل الحفظ"); refetchMemorization(); },
    onError: (e) => toast.error(e.message),
  });

  const createRevisionMutation = trpc.revision.create.useMutation({
    onSuccess: () => { toast.success("تم تسجيل المراجعة"); refetchRevision(); },
    onError: (e) => toast.error(e.message),
  });

  const upsertEvaluationMutation = trpc.evaluation.upsert.useMutation({
    onSuccess: () => { toast.success("تم حفظ التقييم"); refetchEvaluation(); },
    onError: (e) => toast.error(e.message),
  });

  const getSurahName = (num: number) => QURAN_SURAHS.find((s) => s.number === num)?.name ?? `سورة ${num}`;

  const getAttendanceStatus = (studentId: number) =>
    attendance?.find((a) => a.studentId === studentId)?.status;

  const getStudentEvaluation = (studentId: number) =>
    evaluation?.find((e) => e.studentId === studentId);

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
        <p className="text-muted-foreground">الجلسة غير موجودة</p>
        <Link href="/sessions"><button className="mt-4 btn-gold text-sm px-4 py-2">العودة للجلسات</button></Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/sessions"><span className="hover:text-foreground cursor-pointer">الجلسات</span></Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="text-foreground">{session.title ?? `جلسة #${session.id}`}</span>
      </div>

      {/* Session Info Card */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl font-bold text-foreground">{session.title ?? `جلسة #${session.id}`}</h1>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColors[session.status]}`}>{SESSION_STATUS_LABELS[session.status]}</span>
              <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full">{SESSION_TYPE_LABELS[session.type]}</span>
            </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><Clock className="w-4 h-4"/>{new Date(session.scheduledAt).toLocaleDateString("ar-SA", {weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">هجري: {formatHijriDate(session.scheduledAt)}</div>
              {circle && <div className="flex items-center gap-1.5"><BookOpen className="w-4 h-4"/>{circle.name}</div>}
            </div>
          </div>
          <div className="flex gap-2">
            {session.status === "scheduled" && (
              <button onClick={()=>updateStatusMutation.mutate({id:session.id,status:"open"})} className="btn-gold text-sm px-4 py-2">فتح الجلسة</button>
            )}
            {session.status === "open" && (
              <button onClick={()=>updateStatusMutation.mutate({id:session.id,status:"closed"})} className="px-4 py-2 rounded-xl bg-gray-600 text-white text-sm hover:bg-gray-700 transition-colors">إغلاق الجلسة</button>
            )}
          </div>
        </div>
        {session.notes && <p className="mt-3 text-sm text-muted-foreground border-t border-border/50 pt-3">{session.notes}</p>}
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
          <h2 className="font-display font-bold text-foreground text-lg mb-4">تسجيل الحضور</h2>
          {!students || students.length === 0 ? (
            <div className="text-center py-8"><Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3"/><p className="text-muted-foreground text-sm">لا يوجد طلاب في هذه الحلقة</p></div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const status = getAttendanceStatus(student.id);
                return (
                  <div key={student.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-emerald-600/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-emerald-600 text-sm">{student.name.charAt(0)}</span>
                    </div>
                    <span className="flex-1 font-medium text-foreground">{student.name}</span>
                    <div className="flex gap-2">
                      {(["present","absent","late","excused"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => upsertAttendanceMutation.mutate({ sessionId: session.id, studentId: student.id, status: s })}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            status === s
                              ? s === "present" ? "bg-emerald-600 text-white border-emerald-600"
                              : s === "absent" ? "bg-red-600 text-white border-red-600"
                              : s === "late" ? "bg-amber-500 text-white border-amber-500"
                              : "bg-blue-600 text-white border-blue-600"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {ATTENDANCE_STATUS_LABELS[s]}
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
                    onSubmit={(data: any) => createMemorizationMutation.mutate(data)}
                    isLoading={createMemorizationMutation.isPending}
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
                      <span className="text-sm text-muted-foreground">{getSurahName(m.surahNumber)} ({m.fromAyah}-{m.toAyah})</span>
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
                    onSubmit={(data: any) => createRevisionMutation.mutate(data)}
                    isLoading={createRevisionMutation.isPending}
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
                      <span className="text-sm text-muted-foreground">{getSurahName(r.surahNumber)} ({r.fromAyah}-{r.toAyah})</span>
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
    </div>
  );
}

function MemorizationForm({ student, sessionId, onSubmit, isLoading }: any) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button onClick={()=>setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-right">
        <div className="w-8 h-8 rounded-full bg-emerald-600/10 flex items-center justify-center"><span className="font-bold text-emerald-600 text-sm">{student.name.charAt(0)}</span></div>
        <span className="font-medium text-foreground flex-1">{student.name}</span>
        <span className="text-xs text-muted-foreground">{expanded?"إخفاء":"تسجيل حفظ"}</span>
      </button>
      {expanded && (
        <form onSubmit={(e) => { e.preventDefault(); const fd=new FormData(e.currentTarget); onSubmit({sessionId,studentId:student.id,surahNumber:Number(fd.get("surahNumber")),fromAyah:Number(fd.get("fromAyah")),toAyah:Number(fd.get("toAyah")),grade:fd.get("grade")||undefined,notes:fd.get("notes")||undefined}); setExpanded(false); }} className="p-3 pt-0 space-y-3 border-t border-border/50">
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-xs text-muted-foreground mb-1">السورة</label>
              <select name="surahNumber" required className="tarteel-input text-sm py-1.5">
                {QURAN_SURAHS.map(s=><option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-muted-foreground mb-1">من آية</label><input name="fromAyah" type="number" min={1} required className="tarteel-input text-sm py-1.5"/></div>
            <div><label className="block text-xs text-muted-foreground mb-1">إلى آية</label><input name="toAyah" type="number" min={1} required className="tarteel-input text-sm py-1.5"/></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs text-muted-foreground mb-1">التقدير</label>
              <select name="grade" className="tarteel-input text-sm py-1.5">
                <option value="">اختر التقدير</option>
                {Object.entries(GRADE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-muted-foreground mb-1">ملاحظات</label><input name="notes" className="tarteel-input text-sm py-1.5" placeholder="اختياري"/></div>
          </div>
          <button type="submit" disabled={isLoading} className="btn-gold w-full text-sm py-2">{isLoading?"جارٍ الحفظ...":"تسجيل الحفظ"}</button>
        </form>
      )}
    </div>
  );
}

function RevisionForm({ student, sessionId, onSubmit, isLoading }: any) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button onClick={()=>setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-right">
        <div className="w-8 h-8 rounded-full bg-purple-600/10 flex items-center justify-center"><span className="font-bold text-purple-600 text-sm">{student.name.charAt(0)}</span></div>
        <span className="font-medium text-foreground flex-1">{student.name}</span>
        <span className="text-xs text-muted-foreground">{expanded?"إخفاء":"تسجيل مراجعة"}</span>
      </button>
      {expanded && (
        <form onSubmit={(e) => { e.preventDefault(); const fd=new FormData(e.currentTarget); onSubmit({sessionId,studentId:student.id,surahNumber:Number(fd.get("surahNumber")),fromAyah:Number(fd.get("fromAyah")),toAyah:Number(fd.get("toAyah")),grade:fd.get("grade")||undefined,notes:fd.get("notes")||undefined}); setExpanded(false); }} className="p-3 pt-0 space-y-3 border-t border-border/50">
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-xs text-muted-foreground mb-1">السورة</label>
              <select name="surahNumber" required className="tarteel-input text-sm py-1.5">
                {QURAN_SURAHS.map(s=><option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-muted-foreground mb-1">من آية</label><input name="fromAyah" type="number" min={1} required className="tarteel-input text-sm py-1.5"/></div>
            <div><label className="block text-xs text-muted-foreground mb-1">إلى آية</label><input name="toAyah" type="number" min={1} required className="tarteel-input text-sm py-1.5"/></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs text-muted-foreground mb-1">التقدير</label>
              <select name="grade" className="tarteel-input text-sm py-1.5">
                <option value="">اختر التقدير</option>
                {Object.entries(GRADE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-muted-foreground mb-1">ملاحظات</label><input name="notes" className="tarteel-input text-sm py-1.5" placeholder="اختياري"/></div>
          </div>
          <button type="submit" disabled={isLoading} className="btn-gold w-full text-sm py-2">{isLoading?"جارٍ الحفظ...":"تسجيل المراجعة"}</button>
        </form>
      )}
    </div>
  );
}

function EvaluationForm({ student, sessionId, existing, onSubmit, isLoading }: any) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button onClick={()=>setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-right">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><span className="font-bold text-amber-600 text-sm">{student.name.charAt(0)}</span></div>
        <span className="font-medium text-foreground flex-1">{student.name}</span>
        {existing?.totalScore != null && <span className="text-sm font-bold text-primary">{existing.totalScore}/100</span>}
        <span className="text-xs text-muted-foreground">{expanded?"إخفاء":"تقييم"}</span>
      </button>
      {expanded && (
        <form onSubmit={(e) => { e.preventDefault(); const fd=new FormData(e.currentTarget); onSubmit({sessionId,studentId:student.id,tajweedScore:Number(fd.get("tajweedScore"))||undefined,pronunciationScore:Number(fd.get("pronunciationScore"))||undefined,memorizationScore:Number(fd.get("memorizationScore"))||undefined,behaviorScore:Number(fd.get("behaviorScore"))||undefined,totalScore:Number(fd.get("totalScore"))||undefined,notes:fd.get("notes")||undefined}); setExpanded(false); }} className="p-3 pt-0 space-y-3 border-t border-border/50">
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
