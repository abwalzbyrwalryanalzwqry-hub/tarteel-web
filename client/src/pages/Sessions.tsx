import EntityForm, { FormInput } from "@/components/EntityForm";
import { NewSessionComposer, type NewSessionValues } from "@/components/NewSessionComposer";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ClipboardList, Edit, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { SESSION_STATUS_LABELS, SESSION_TYPE_LABELS } from "../../../shared/types";
import { Calendar } from "@/components/ui/calendar";
import { usePermissions } from "@/hooks/usePermissions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function Sessions() {
  const { can, role } = usePermissions();
  const isTeachingRole = role === "teacher" || role === "assistant_teacher";
  const canManageSessions = can("sessions:manage");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: sessions, isLoading, refetch } = trpc.sessions.list.useQuery({ circleId: undefined, seasonId: undefined });
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
    onSuccess: (result) => {
      toast.success("تم إنشاء الفترة بنجاح");
      setShowForm(false);
      refetch();
      syncSharedData();
      if (result.sessionId) navigate(`/periods/${result.sessionId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.sessions.updateStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث حالة الفترة"); refetch(); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الفترة"); refetch(); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.sessions.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الفترة"); setEditItem(null); refetch(); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => (sessions?.filter((s) => {
    const matchesSearch = (s.title ?? "").includes(search) || String(s.id).includes(search);
    if (!selectedDate) return matchesSearch;
    const sessionDate = new Date(s.scheduledAt);
    return matchesSearch && sessionDate.getFullYear() === selectedDate.getFullYear() && sessionDate.getMonth() === selectedDate.getMonth() && sessionDate.getDate() === selectedDate.getDate();
  }) ?? []), [sessions, search, selectedDate]);
  const sessionDays = useMemo(() => (sessions ?? []).map((session) => new Date(session.scheduledAt)), [sessions]);

  function handleCreate(values: NewSessionValues) {
    createMutation.mutate({
      ...values,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({ id: editItem.id, title: String(fd.get("title") || "") || null, type: fd.get("type") as any, scheduledAt: new Date(String(fd.get("scheduledAt"))), notes: String(fd.get("notes") || "") || null, status: fd.get("status") as any });
  }

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">الفترات</h1><p className="page-subtitle">فترات التحفيظ والحضور وسجل الطلاب</p></div>
        </div>
          <div className="flex items-center gap-2"><Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><button className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${selectedDate ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background/70 text-foreground hover:bg-muted"}`}><CalendarDays className="ml-1 inline h-4 w-4" />{selectedDate ? selectedDate.toLocaleDateString("ar-SA", { month: "short", day: "numeric" }) : "التقويم"}</button></PopoverTrigger><PopoverContent align="end" className="w-auto p-0" dir="rtl"><Calendar mode="single" selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} modifiers={{ hasSession: sessionDays }} modifiersClassNames={{ hasSession: "bg-primary/10 font-bold text-primary" }} footer={<p className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">الأيام المظللة تحتوي فترات. {selectedDate && <button onClick={() => setSelectedDate(undefined)} className="mr-2 text-primary hover:underline">إزالة التصفية</button>}</p>} /></PopoverContent></Popover>{canManageSessions && <button onClick={()=>setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4"/>فترة جديدة</button>}</div>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="بحث في الفترات..." className="tarteel-input pr-10"/>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="glass-card rounded-2xl p-4"><div className="skeleton h-5 w-48 mb-2"/><div className="skeleton h-4 w-32"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><ClipboardList className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا توجد فترات</p>{canManageSessions && <button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إنشاء أول فترة</button>}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((session, i) => (
            <div key={session.id} className={`glass-card rounded-2xl p-4 animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0"><ClipboardList className="w-5 h-5 text-blue-600"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{session.title ?? `فترة #${session.id}`}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[session.status]}`}>{SESSION_STATUS_LABELS[session.status]}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{SESSION_TYPE_LABELS[session.type]}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{new Date(session.scheduledAt).toLocaleDateString("ar-SA", {weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {session.status === "scheduled" && (
                    <button onClick={()=>updateStatusMutation.mutate({id:session.id,status:"open"})} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">فتح</button>
                  )}
                  {session.status === "open" && (
                    <button onClick={()=>updateStatusMutation.mutate({id:session.id,status:"closed"})} className="text-xs px-3 py-1.5 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition-colors">إغلاق</button>
                  )}
                  {canManageSessions && <button onClick={() => setEditItem(session)} className="text-xs px-3 py-1.5 rounded-lg border border-primary/25 text-primary hover:bg-primary/5 transition-colors"><Edit className="ml-1 inline w-3 h-3"/>تعديل</button>}
                  <Link href={`/periods/${session.id}`}>
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1">
                      <Edit className="w-3 h-3"/>فتح الفترة
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <NewSessionComposer open={showForm} onOpenChange={setShowForm} circles={circles} teachers={teachers} seasons={seasons} isTeachingRole={isTeachingRole} isLoading={createMutation.isPending} onSubmit={handleCreate} />
      {editItem&&<EntityForm title="تعديل الفترة" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="حفظ التعديلات"><FormInput label="عنوان الفترة" name="title" defaultValue={editItem.title??""}/><div><label className="block text-sm font-medium text-foreground mb-1.5">نوع الفترة</label><select name="type" defaultValue={editItem.type} className="tarteel-input">{Object.entries(SESSION_TYPE_LABELS).map(([key, value])=><option key={key} value={key}>{value}</option>)}</select></div><FormInput label="موعد الفترة" name="scheduledAt" type="datetime-local" required defaultValue={new Date(editItem.scheduledAt).toISOString().slice(0,16)}/><div><label className="block text-sm font-medium text-foreground mb-1.5">الحالة</label><select name="status" defaultValue={editItem.status} className="tarteel-input">{Object.entries(SESSION_STATUS_LABELS).map(([key, value])=><option key={key} value={key}>{value}</option>)}</select></div><div><label className="block text-sm font-medium text-foreground mb-1.5">ملاحظات</label><textarea name="notes" defaultValue={editItem.notes??""} rows={2} className="tarteel-input resize-none"/></div></EntityForm>}
    </div>
  );
}
