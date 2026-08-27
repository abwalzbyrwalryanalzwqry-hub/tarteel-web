import EntityForm, { FormInput } from "@/components/EntityForm";
import { NewSessionComposer, type NewSessionValues } from "@/components/NewSessionComposer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ClipboardList, Edit, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { SESSION_STATUS_LABELS, SESSION_TYPE_LABELS } from "../../../shared/types";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDualCalendarDate, getRiyadhDayKey } from "../../../shared/dates";

type PeriodRow = { id: number; title: string | null; type: "regular" | "exam" | "review" | "special"; status: "draft" | "scheduled" | "open" | "closed" | "cancelled"; scheduledAt: Date | string; notes: string | null };

function periodName(period: Pick<PeriodRow, "title" | "type">) {
  return period.title?.trim() || SESSION_TYPE_LABELS[period.type] || "فترة";
}

export default function Sessions() {
  const { can, role } = usePermissions();
  const isTeachingRole = role === "teacher" || role === "assistant_teacher";
  const canManageSessions = can("sessions:manage");
  const [showForm, setShowForm] = useState(false);
  const [createConflict, setCreateConflict] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<PeriodRow | null>(null);
  const [actionItem, setActionItem] = useState<PeriodRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<PeriodRow | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: sessions, isLoading, refetch } = trpc.sessions.list.useQuery({ circleId: undefined, seasonId: undefined, includeDrafts: false });
  const { data: sessionsWithDrafts } = trpc.sessions.list.useQuery({ circleId: undefined, seasonId: undefined, includeDrafts: true });
  const { data: circles } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });
  const { data: teachers } = trpc.teachers.list.useQuery({ centerId: undefined });
  const { data: seasons } = trpc.seasons.list.useQuery({ centerId: undefined });
  const syncSharedData = () => void Promise.all([
    utils.dashboard.stats.invalidate(),
    utils.dashboard.recentSessions.invalidate(),
    utils.sessions.list.invalidate(),
    utils.students.list.invalidate(),
    utils.circles.list.invalidate(),
  ]);

  const createMutation = trpc.sessions.create.useMutation({
    onSuccess: async (result, values) => {
      let periodId = Number(result?.periodId ?? result?.sessionId);
      if (!Number.isInteger(periodId) || periodId < 1) {
        const created = await utils.sessions.byDay.fetch({ circleId: values.circleId, scheduledAt: values.scheduledAt });
        periodId = Number(created?.id);
      }
      if (!Number.isInteger(periodId) || periodId < 1) { toast.error("تم حفظ المسودة، لكن تعذر فتح سجل طلابها. افتحها من قسم المسودات المحفوظة."); return; }
      toast.success("تم إنشاء الفترة بنجاح");
      setCreateConflict(null);
      setShowForm(false);
      navigate(`/periods/${periodId}`, { replace: true });
      refetch();
      syncSharedData();
    },
    onError: (error) => { setCreateConflict(error.message); toast.error(error.message); },
  });
  const updateStatusMutation = trpc.sessions.updateStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث حالة الفترة"); refetch(); syncSharedData(); },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => { toast.success("نُقلت الفترة إلى سلة المهملات ويمكن استرجاعها لاحقاً"); setDeleteItem(null); setActionItem(null); refetch(); syncSharedData(); },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = trpc.sessions.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الفترة"); setEditItem(null); setActionItem(null); refetch(); syncSharedData(); },
    onError: (error) => toast.error(error.message),
  });

  const filtered = useMemo(() => (sessions?.filter((session) => {
    const matchesSearch = periodName(session as PeriodRow).includes(search) || String(session.id).includes(search);
    if (!selectedDate) return matchesSearch;
    const sessionDate = new Date(session.scheduledAt);
    return matchesSearch && sessionDate.getFullYear() === selectedDate.getFullYear() && sessionDate.getMonth() === selectedDate.getMonth() && sessionDate.getDate() === selectedDate.getDate();
  }) ?? []) as PeriodRow[], [sessions, search, selectedDate]);
  const sessionDays = useMemo(() => (sessions ?? []).map((session) => new Date(session.scheduledAt)), [sessions]);
  const drafts = useMemo(() => (sessionsWithDrafts?.filter((session) => session.status === "draft") ?? []) as PeriodRow[], [sessionsWithDrafts]);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => getRiyadhDayKey(today), [today]);
  const todaySessions = useMemo(() => ((sessionsWithDrafts ?? []) as PeriodRow[])
    .filter((period) => getRiyadhDayKey(period.scheduledAt) === todayKey)
    .sort((a, b) => {
      const priority = (period: PeriodRow) => period.status === "draft" ? 0 : period.status === "open" ? 1 : period.status === "scheduled" ? 2 : 3;
      return priority(a) - priority(b);
    }), [sessionsWithDrafts, todayKey]);
  const todayDate = useMemo(() => formatDualCalendarDate(today), [today]);

  const clearHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; };
  const startHold = (period: PeriodRow) => {
    if (!canManageSessions) return;
    holdTriggered.current = false;
    clearHold();
    holdTimer.current = setTimeout(() => { holdTriggered.current = true; setActionItem(period); }, 600);
  };
  const openPeriod = (period: PeriodRow) => {
    if (holdTriggered.current) { holdTriggered.current = false; return; }
    navigate(`/periods/${period.id}`);
  };
  const handleCreate = (values: NewSessionValues) => { setCreateConflict(null); createMutation.mutate(values); };
  const handleUpdate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editItem) return;
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title") || "").trim();
    if (!title) { toast.error("اكتب اسم الفترة"); return; }
    updateMutation.mutate({ id: editItem.id, title, scheduledAt: new Date(String(fields.get("scheduledAt"))), notes: String(fields.get("notes") || "") || null, status: fields.get("status") as "draft" | "scheduled" | "open" | "closed" | "cancelled" });
  };

  const statusColors: Record<PeriodRow["status"], string> = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><ClipboardList className="h-5 w-5 text-white" /></div><div><h1 className="page-title">الفترات</h1><p className="page-subtitle">انقر الفترة لفتح سجل الطلاب، واضغط مطولاً لإدارتها.</p></div></div>
        <div className="flex items-center gap-2"><Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><button className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${selectedDate ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background/70 text-foreground hover:bg-muted"}`}><CalendarDays className="ml-1 inline h-4 w-4" />{selectedDate ? selectedDate.toLocaleDateString("ar-SA", { month: "short", day: "numeric" }) : "التقويم"}</button></PopoverTrigger><PopoverContent align="end" className="w-auto p-0" dir="rtl"><Calendar mode="single" selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} modifiers={{ hasSession: sessionDays }} modifiersClassNames={{ hasSession: "bg-primary/10 font-bold text-primary" }} footer={<p className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">الأيام المظللة تحتوي فترات. {selectedDate && <button onClick={() => setSelectedDate(undefined)} className="mr-2 text-primary hover:underline">إزالة التصفية</button>}</p>} /></PopoverContent></Popover>{canManageSessions && <button onClick={() => setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="h-4 w-4" />فترة جديدة</button>}</div>
      </header>
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-display text-lg font-bold text-foreground">جلسة اليوم</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{todayDate.gregorian} <span className="text-primary">· {todayDate.hijri}</span></p></div><span className="rounded-full bg-background px-2.5 py-1 text-xs font-bold text-primary">{todaySessions.length} {todaySessions.length === 1 ? "فترة" : "فترات"}</span></div>
        {todaySessions.length > 0 ? <div className="mt-3 grid gap-2">{todaySessions.slice(0, 3).map((period) => <button key={period.id} type="button" onClick={() => openPeriod(period)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/15 bg-background/85 px-3 py-3 text-right transition-colors hover:bg-primary/5"><span className="min-w-0"><strong className="block truncate text-sm text-foreground">{periodName(period)}</strong><span className="mt-1 block text-xs text-muted-foreground">{period.status === "draft" ? "مسودة محفوظة وجاهزة للاستئناف" : SESSION_STATUS_LABELS[period.status]}</span></span><span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{period.status === "draft" ? "استئناف" : "فتح"}</span></button>)}</div> : <div className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-primary/25 bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm leading-6 text-muted-foreground">لا توجد فترة مسجلة لهذا اليوم. أنشئها الآن، ثم افتح سجل الطلاب مباشرة.</p>{canManageSessions && <button type="button" onClick={() => setShowForm(true)} className="btn-gold shrink-0 px-4 py-2 text-sm">إنشاء جلسة اليوم</button>}</div>}
        {todaySessions.length > 3 && <p className="mt-3 text-xs text-muted-foreground">تظهر أول ثلاث فترات ذات أولوية؛ راجع القائمة الكاملة لبقية فترات اليوم.</p>}
      </section>
      <div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث في أسماء الفترات…" className="tarteel-input pr-10" /></div>
      {drafts.length > 0 && <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-foreground">مسودات محفوظة تلقائياً</h2><p className="mt-1 text-sm text-muted-foreground">أكمل التسجيل من حيث توقفت، ثم اختر «مراجعة وحفظ الفترة» داخلها قبل إضافتها إلى الفترات والتقارير.</p></div><span className="rounded-full bg-background px-2.5 py-1 text-xs font-bold text-amber-800">{drafts.length}</span></div><div className="mt-3 space-y-2">{drafts.map((draft) => <div key={draft.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-background/80 px-3 py-3"><button onClick={() => openPeriod(draft)} className="min-w-0 flex-1 text-right"><strong className="block text-sm text-foreground">{periodName(draft)}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{new Date(draft.scheduledAt).toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric" })}</span><span className="mt-2 inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">استئناف</span></button>{canManageSessions && <button onClick={() => setActionItem(draft)} aria-label={`إدارة ${periodName(draft)}`} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>}</div>)}</div></section>}
      {isLoading ? <div className="space-y-3">{[1, 2, 3, 4].map((item) => <div key={item} className="glass-card rounded-2xl p-4"><div className="skeleton mb-2 h-5 w-48" /><div className="skeleton h-4 w-32" /></div>)}</div> : filtered.length === 0 ? <div className="py-16 text-center"><ClipboardList className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" /><p className="text-muted-foreground">لا توجد فترات</p>{canManageSessions && <button onClick={() => setShowForm(true)} className="btn-gold mt-4 px-4 py-2 text-sm">إنشاء أول فترة</button>}</div> : <div className="space-y-3">{filtered.map((period, index) => <article key={period.id} tabIndex={0} role="link" aria-label={`فتح فترة ${periodName(period)}`} onClick={() => openPeriod(period)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPeriod(period); } }} onPointerDown={() => startHold(period)} onPointerUp={clearHold} onPointerCancel={clearHold} onPointerLeave={clearHold} className={`glass-card group cursor-pointer rounded-2xl p-4 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary animate-fade-in-up stagger-${(index % 5) + 1}`}><div className="flex items-center gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10"><ClipboardList className="h-5 w-5 text-blue-600" /></div><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground">{periodName(period)}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[period.status]}`}>{SESSION_STATUS_LABELS[period.status]}</span></div><p className="text-sm text-muted-foreground">{new Date(period.scheduledAt).toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div><div className="flex shrink-0 items-center gap-1">{period.status === "scheduled" && <button onClick={(event) => { event.stopPropagation(); updateStatusMutation.mutate({ id: period.id, status: "open" }); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700">فتح</button>}{period.status === "open" && <button onClick={(event) => { event.stopPropagation(); updateStatusMutation.mutate({ id: period.id, status: "closed" }); }} className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs text-white hover:bg-gray-700">إغلاق</button>}{canManageSessions && <button onClick={(event) => { event.stopPropagation(); setActionItem(period); }} aria-label={`إدارة ${periodName(period)}`} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>}</div></div></article>)}</div>}
      <NewSessionComposer open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setCreateConflict(null); }} circles={circles} teachers={teachers} seasons={seasons} isTeachingRole={isTeachingRole} isLoading={createMutation.isPending} conflictMessage={createConflict} onClearConflict={() => setCreateConflict(null)} onSubmit={handleCreate} />
      <Dialog open={Boolean(actionItem)} onOpenChange={(open) => !open && setActionItem(null)}><DialogContent className="sm:max-w-md" dir="rtl"><DialogHeader><DialogTitle className="font-display text-xl">إدارة الفترة</DialogTitle><DialogDescription>{actionItem ? `إجراءات الفترة «${periodName(actionItem)}»` : ""}</DialogDescription></DialogHeader><div className="grid gap-2"><button onClick={() => { if (!actionItem) return; setEditItem(actionItem); setActionItem(null); }} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-right font-semibold text-foreground hover:bg-muted"><Edit className="h-5 w-5 text-primary" />تعديل بيانات الفترة</button><button onClick={() => { if (!actionItem) return; setDeleteItem(actionItem); setActionItem(null); }} className="flex items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-right font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-5 w-5" />نقل إلى سلة المهملات</button></div></DialogContent></Dialog>
      <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle className="font-display">نقل الفترة إلى سلة المهملات؟</AlertDialogTitle><AlertDialogDescription>سيُنقل سجل «{deleteItem ? periodName(deleteItem) : ""}» بكل بياناته إلى السلة، ولن يظهر في التقارير. يمكنك استرجاعه من سلة المهملات لاحقاً.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (deleteItem) deleteMutation.mutate({ id: deleteItem.id }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteMutation.isPending ? "جارٍ النقل…" : "تأكيد النقل إلى السلة"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      {editItem && <EntityForm title="تعديل الفترة" onClose={() => setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="حفظ التعديلات"><FormInput label="اسم الفترة" name="title" defaultValue={periodName(editItem)} required /><FormInput label="موعد الفترة" name="scheduledAt" type="datetime-local" required defaultValue={new Date(editItem.scheduledAt).toISOString().slice(0, 16)} /><div><label className="mb-1.5 block text-sm font-medium text-foreground">الحالة</label><select name="status" defaultValue={editItem.status} className="tarteel-input">{Object.entries(SESSION_STATUS_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div><div><label className="mb-1.5 block text-sm font-medium text-foreground">ملاحظات</label><textarea name="notes" defaultValue={editItem.notes ?? ""} rows={3} className="tarteel-input resize-none" /></div></EntityForm>}
    </div>
  );
}
