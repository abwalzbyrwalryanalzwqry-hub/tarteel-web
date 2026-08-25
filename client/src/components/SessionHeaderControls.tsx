import { CalendarDays, ChevronDown, Clock3, PencilLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDualCalendarDate, getHijriDateParts, hijriToGregorian } from "../../../shared/dates";

type SessionRow = { id: number; type: "regular" | "exam" | "review" | "special"; title: string | null; scheduledAt: Date | string };

const sessionKinds = [
  { value: "regular" as const, label: "يومية", description: "متابعة الحفظ والمراجعة اليومية" },
  { value: "review" as const, label: "درس", description: "درس أو متابعة تعليمية موجهة" },
  { value: "exam" as const, label: "اختبار", description: "تقييم أو اختبار للحلقة" },
  { value: "special" as const, label: "مخصصة", description: "اكتب اسم الجلسة كما تريد" },
];

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function SessionHeaderControls({ session }: { session: SessionRow }) {
  const utils = trpc.useUtils();
  const [typeOpen, setTypeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [kind, setKind] = useState<SessionRow["type"]>(session.type);
  const [customTitle, setCustomTitle] = useState(session.type === "special" ? session.title ?? "" : "");
  const [selectedDate, setSelectedDate] = useState(() => new Date(session.scheduledAt));
  const [hijriDraft, setHijriDraft] = useState(() => getHijriDateParts(new Date(session.scheduledAt)) ?? { year: 1448, month: 1, day: 1 });
  const update = trpc.sessions.update.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث بيانات الفترة");
      await Promise.all([utils.sessions.byId.invalidate({ id: session.id }), utils.sessions.list.invalidate(), utils.dashboard.stats.invalidate(), utils.dashboard.recentSessions.invalidate()]);
      setTypeOpen(false);
      setDateOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const currentKind = sessionKinds.find((item) => item.value === session.type) ?? sessionKinds[0];
  const calendars = formatDualCalendarDate(selectedDate);
  const chooseCalendarDate = (next: Date | undefined) => {
    if (!next) return;
    const result = new Date(next);
    result.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setSelectedDate(result);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => { setKind(session.type); setCustomTitle(session.type === "special" ? session.title ?? "" : ""); setTypeOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10">
        <PencilLine className="h-4 w-4" />
        <span>النوع: {currentKind.label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => { setSelectedDate(new Date(session.scheduledAt)); setDateOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
        <CalendarDays className="h-4 w-4 text-primary" />
        <span>التاريخ</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle className="font-display text-xl">نوع الفترة</DialogTitle><DialogDescription>اختر نوع الفترة، ويمكن تسمية النوع المخصص بما يناسب الحلقة.</DialogDescription></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {sessionKinds.map((item) => <button key={item.value} type="button" onClick={() => setKind(item.value)} className={`rounded-2xl border p-4 text-right transition-colors ${kind === item.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50"}`}><span className="block font-bold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></button>)}
          </div>
          {kind === "special" && <label className="block"><span className="mb-1.5 block text-sm font-semibold">اسم الفترة المخصص</span><input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="مثال: زيارة الشيخ" className="tarteel-input" maxLength={120} /></label>}
          <button disabled={update.isPending || (kind === "special" && !customTitle.trim())} onClick={() => update.mutate({ id: session.id, type: kind, title: kind === "special" ? customTitle.trim() : session.title })} className="btn-gold w-full py-3">{update.isPending ? "جارٍ الحفظ…" : "حفظ النوع"}</button>
        </DialogContent>
      </Dialog>

      <Dialog open={dateOpen} onOpenChange={setDateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir="rtl">
          <DialogHeader><DialogTitle className="font-display text-xl">تحديد تاريخ الفترة</DialogTitle><DialogDescription>اختر التاريخ من التقويم أو أدخله يدوياً. يعرض التطبيق التاريخين الهجري والميلادي تلقائياً.</DialogDescription></DialogHeader>
          <div className="grid gap-3 rounded-2xl bg-primary/5 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">الميلادي</p><p className="mt-1 font-semibold text-foreground">{calendars.gregorian}</p></div><div><p className="text-xs text-muted-foreground">الهجري</p><p className="mt-1 font-semibold text-primary">{calendars.hijri}</p></div></div>
          <div className="rounded-2xl border border-border p-2"><Calendar mode="single" selected={selectedDate} onSelect={chooseCalendarDate} className="mx-auto" /></div>
          <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><Clock3 className="h-4 w-4 text-primary" />تعديل يدوي للميلادي والوقت</span><input type="datetime-local" value={toDateTimeLocal(selectedDate)} onChange={(event) => { const next = new Date(event.target.value); if (!Number.isNaN(next.getTime())) { setSelectedDate(next); setHijriDraft(getHijriDateParts(next) ?? hijriDraft); } }} className="tarteel-input" /></label>
          <div className="rounded-2xl border border-border bg-muted/30 p-3"><p className="mb-2 text-sm font-semibold">تعديل يدوي للهجري</p><div className="grid grid-cols-3 gap-2"><label><span className="mb-1 block text-xs text-muted-foreground">اليوم</span><input dir="ltr" inputMode="numeric" value={hijriDraft.day} onChange={(event) => setHijriDraft({ ...hijriDraft, day: Number(event.target.value) || 0 })} className="tarteel-input text-center" /></label><label><span className="mb-1 block text-xs text-muted-foreground">الشهر</span><input dir="ltr" inputMode="numeric" value={hijriDraft.month} onChange={(event) => setHijriDraft({ ...hijriDraft, month: Number(event.target.value) || 0 })} className="tarteel-input text-center" /></label><label><span className="mb-1 block text-xs text-muted-foreground">السنة</span><input dir="ltr" inputMode="numeric" value={hijriDraft.year} onChange={(event) => setHijriDraft({ ...hijriDraft, year: Number(event.target.value) || 0 })} className="tarteel-input text-center" /></label></div><button type="button" onClick={() => { const date = hijriToGregorian(hijriDraft); if (!date) { toast.error("التاريخ الهجري غير صالح"); return; } date.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0); setSelectedDate(date); }} className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">تطبيق التاريخ الهجري</button></div>
          <button disabled={update.isPending} onClick={() => update.mutate({ id: session.id, scheduledAt: selectedDate })} className="btn-gold w-full py-3">{update.isPending ? "جارٍ الحفظ…" : "حفظ التاريخ"}</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
