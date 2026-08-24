import EntityForm, { FormInput } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ClipboardList, Edit, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { SESSION_STATUS_LABELS, SESSION_TYPE_LABELS } from "../../../shared/types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function Sessions() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: sessions, isLoading, refetch } = trpc.sessions.list.useQuery({ circleId: undefined, seasonId: undefined });
  const { data: circles } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });
  const { data: teachers } = trpc.teachers.list.useQuery({ centerId: undefined });
  const { data: seasons } = trpc.seasons.list.useQuery({ centerId: undefined });

  const createMutation = trpc.sessions.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء الجلسة بنجاح"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.sessions.updateStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث حالة الجلسة"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الجلسة"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => (sessions?.filter((s) => {
    const matchesSearch = (s.title ?? "").includes(search) || String(s.id).includes(search);
    if (!selectedDate) return matchesSearch;
    const sessionDate = new Date(s.scheduledAt);
    return matchesSearch && sessionDate.getFullYear() === selectedDate.getFullYear() && sessionDate.getMonth() === selectedDate.getMonth() && sessionDate.getDate() === selectedDate.getDate();
  }) ?? []), [sessions, search, selectedDate]);
  const sessionDays = useMemo(() => (sessions ?? []).map((session) => new Date(session.scheduledAt)), [sessions]);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      circleId: Number(fd.get("circleId")),
      teacherId: Number(fd.get("teacherId")),
      seasonId: Number(fd.get("seasonId")),
      title: fd.get("title") as string,
      type: (fd.get("type") as any) || "regular",
      scheduledAt: new Date(fd.get("scheduledAt") as string),
      notes: fd.get("notes") as string,
    });
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
          <div><h1 className="page-title">الجلسات</h1><p className="page-subtitle">إدارة جلسات التحفيظ والحضور</p></div>
        </div>
        <div className="flex items-center gap-2"><Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><button className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${selectedDate ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background/70 text-foreground hover:bg-muted"}`}><CalendarDays className="ml-1 inline h-4 w-4" />{selectedDate ? selectedDate.toLocaleDateString("ar-SA", { month: "short", day: "numeric" }) : "التقويم"}</button></PopoverTrigger><PopoverContent align="end" className="w-auto p-0" dir="rtl"><Calendar mode="single" selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} modifiers={{ hasSession: sessionDays }} modifiersClassNames={{ hasSession: "bg-primary/10 font-bold text-primary" }} footer={<p className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">الأيام المظللة تحتوي جلسات. {selectedDate && <button onClick={() => setSelectedDate(undefined)} className="mr-2 text-primary hover:underline">إزالة التصفية</button>}</p>} /></PopoverContent></Popover><button onClick={()=>setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4"/>جلسة جديدة</button></div>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="بحث في الجلسات..." className="tarteel-input pr-10"/>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="glass-card rounded-2xl p-4"><div className="skeleton h-5 w-48 mb-2"/><div className="skeleton h-4 w-32"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><ClipboardList className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا توجد جلسات</p><button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إنشاء أول جلسة</button></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((session, i) => (
            <div key={session.id} className={`glass-card rounded-2xl p-4 animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0"><ClipboardList className="w-5 h-5 text-blue-600"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{session.title ?? `جلسة #${session.id}`}</h3>
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
                  <Link href={`/sessions/${session.id}`}>
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1">
                      <Edit className="w-3 h-3"/>تفاصيل
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm&&<EntityForm title="إنشاء جلسة جديدة" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الحلقة <span className="text-destructive">*</span></label>
          <select name="circleId" required className="tarteel-input"><option value="">اختر الحلقة</option>{circles?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المعلم <span className="text-destructive">*</span></label>
          <select name="teacherId" required className="tarteel-input"><option value="">اختر المعلم</option>{teachers?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الموسم الدراسي <span className="text-destructive">*</span></label>
          <select name="seasonId" required className="tarteel-input"><option value="">اختر الموسم</option>{seasons?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <FormInput label="عنوان الجلسة" name="title" placeholder="جلسة الأسبوع الأول"/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">نوع الجلسة</label>
          <select name="type" className="tarteel-input">
            {Object.entries(SESSION_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <FormInput label="موعد الجلسة" name="scheduledAt" type="datetime-local" required/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">ملاحظات</label>
          <textarea name="notes" rows={2} className="tarteel-input resize-none" placeholder="ملاحظات إضافية..."/></div>
      </EntityForm>}
    </div>
  );
}
