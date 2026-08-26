import { CalendarDays, Clock3, FileText, Layers3, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDualCalendarDate, getHijriDateParts, hijriToGregorian } from "../../../shared/dates";

export type NewSessionValues = {
  circleId: number;
  teacherId?: number;
  seasonId?: number;
  title?: string;
  type: "regular" | "exam" | "review" | "special";
  scheduledAt: Date;
  notes?: string;
};

type CircleOption = { id: number; name: string; seasonId?: number | null };
type TeacherOption = { id: number; name: string };
type SeasonOption = { id: number; name: string };

const periodNameOptions = [
  { id: "daily", type: "regular" as const, label: "يومية", description: "متابعة يومية للحلقة" },
  { id: "memorization-review", type: "review" as const, label: "حفظ ومراجعة", description: "تسجيل الحفظ والمراجعة" },
  { id: "exam", type: "exam" as const, label: "اختبار", description: "تقييم مستوى الطلاب" },
  { id: "lessons", type: "special" as const, label: "دروس", description: "درس أو متابعة تعليمية" },
  { id: "lecture", type: "special" as const, label: "محاضرة", description: "محاضرة أو لقاء تربوي" },
  { id: "custom", type: "special" as const, label: "تخصيص", description: "اكتب اسماً يناسب الفترة" },
];

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function NewSessionComposer({
  open,
  onOpenChange,
  circles,
  teachers,
  seasons,
  isTeachingRole,
  isLoading,
  conflictMessage,
  onClearConflict,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circles?: CircleOption[];
  teachers?: TeacherOption[];
  seasons?: SeasonOption[];
  isTeachingRole: boolean;
  isLoading: boolean;
  conflictMessage?: string | null;
  onClearConflict?: () => void;
  onSubmit: (values: NewSessionValues) => void;
}) {
  const [circleId, setCircleId] = useState<number | undefined>();
  const [teacherId, setTeacherId] = useState<number | undefined>();
  const [seasonId, setSeasonId] = useState<number | undefined>();
  const [title, setTitle] = useState("يومية");
  const [kind, setKind] = useState<NewSessionValues["type"]>("regular");
  const [nameOption, setNameOption] = useState("daily");
  const [scheduledAt, setScheduledAt] = useState(() => new Date());
  const [notes, setNotes] = useState("");
  const [showDateEditor, setShowDateEditor] = useState(false);
  const [hijriDraft, setHijriDraft] = useState(() => getHijriDateParts(new Date()) ?? { year: 1448, month: 1, day: 1 });

  useEffect(() => {
    if (!open || circleId || !circles?.length) return;
    const firstCircle = circles[0];
    setCircleId(firstCircle.id);
    if (isTeachingRole && firstCircle.seasonId) setSeasonId(firstCircle.seasonId);
  }, [circleId, circles, isTeachingRole, open]);

  useEffect(() => {
    if (open) return;
    setCircleId(undefined);
    setTeacherId(undefined);
    setSeasonId(undefined);
    setTitle("يومية");
    setKind("regular");
    setNameOption("daily");
    const now = new Date();
    setScheduledAt(now);
    setHijriDraft(getHijriDateParts(now) ?? { year: 1448, month: 1, day: 1 });
    setNotes("");
    setShowDateEditor(false);
  }, [open]);

  useEffect(() => {
    if (open && conflictMessage) setShowDateEditor(true);
  }, [conflictMessage, open]);

  const selectedCircle = circles?.find((circle) => circle.id === circleId);
  const dualDate = formatDualCalendarDate(scheduledAt);

  const resetAndClose = () => {
    onOpenChange(false);
  };

  const chooseCircle = (value: string) => {
    const nextCircleId = Number(value);
    const nextCircle = circles?.find((circle) => circle.id === nextCircleId);
    setCircleId(nextCircleId || undefined);
    onClearConflict?.();
    if (isTeachingRole) setSeasonId(nextCircle?.seasonId ?? undefined);
  };

  const submit = () => {
    if (!circleId) {
      toast.error("اختر الحلقة أولاً");
      return;
    }
    if (!isTeachingRole && (!teacherId || !seasonId)) {
      toast.error("اختر المعلم والموسم الدراسي");
      return;
    }
    if (!title.trim()) {
      toast.error("اكتب اسم الفترة");
      return;
    }
    onSubmit({
      circleId,
      teacherId,
      seasonId: isTeachingRole ? selectedCircle?.seasonId ?? seasonId : seasonId,
      title: title.trim() || undefined,
      type: kind,
      scheduledAt,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl" dir="rtl">
        <DialogHeader className="border-b border-border bg-gradient-to-l from-primary/10 via-background to-amber-500/10 px-5 py-5 text-right sm:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20"><Sparkles className="h-5 w-5" /></div>
            <div><DialogTitle className="font-display text-2xl">فترة جديدة</DialogTitle><DialogDescription className="mt-1">كل فترة تخص التاريخ الذي تختاره. لا يمكن تكرار فترة للحلقة نفسها في التاريخ نفسه.</DialogDescription></div>
          </div>
        </DialogHeader>

        <div className="space-y-5 p-5 sm:p-7">
          <section className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2"><Layers3 className="h-4 w-4 text-primary" /><h3 className="font-display font-bold">نطاق الجلسة</h3></div>
            <div className={`grid gap-3 ${isTeachingRole ? "" : "sm:grid-cols-3"}`}>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">الحلقة <span className="text-destructive">*</span></span><select value={circleId ?? ""} onChange={(event) => chooseCircle(event.target.value)} className="tarteel-input"><option value="">اختر الحلقة</option>{circles?.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></label>
              {!isTeachingRole && <label className="block"><span className="mb-1.5 block text-sm font-semibold">المعلم <span className="text-destructive">*</span></span><select value={teacherId ?? ""} onChange={(event) => setTeacherId(Number(event.target.value) || undefined)} className="tarteel-input"><option value="">اختر المعلم</option>{teachers?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>}
              {!isTeachingRole && <label className="block"><span className="mb-1.5 block text-sm font-semibold">الموسم الدراسي <span className="text-destructive">*</span></span><select value={seasonId ?? ""} onChange={(event) => setSeasonId(Number(event.target.value) || undefined)} className="tarteel-input"><option value="">اختر الموسم</option>{seasons?.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h3 className="font-display font-bold">اسم الفترة</h3></div>
            <p className="mb-3 text-sm text-muted-foreground">اختر اسماً جاهزاً، أو اكتب الاسم الذي تريده مباشرة. الاسم هو الوصف الظاهر للفترة في كل القوائم والتقارير.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{periodNameOptions.map((item) => <button type="button" key={item.id} onClick={() => { setNameOption(item.id); setKind(item.type); setTitle(item.id === "custom" ? "" : item.label); }} aria-pressed={nameOption === item.id} className={`rounded-2xl border p-3 text-right transition-all ${nameOption === item.id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background hover:border-primary/35 hover:bg-primary/5"}`}><span className="block text-sm font-bold">{item.label}</span><span className={`mt-1 block text-[11px] leading-4 ${nameOption === item.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.description}</span></button>)}</div>
            <label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold">اسم الفترة <span className="text-destructive">*</span></span><input value={title} onChange={(event) => { setTitle(event.target.value); if (nameOption !== "custom" && event.target.value !== periodNameOptions.find((item) => item.id === nameOption)?.label) setNameOption("custom"); }} maxLength={120} placeholder="مثال: برنامج الإتقان الأسبوعي" className="tarteel-input" /></label>
          </section>

          <section className="rounded-2xl border border-border bg-background/70 p-4">
            <button type="button" onClick={() => setShowDateEditor((current) => !current)} className="flex w-full items-center justify-between gap-3 text-right"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><span className="font-display font-bold">موعد الفترة <span className="text-destructive">*</span></span></span><span className="rounded-xl bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">{showDateEditor ? "إخفاء التحديد" : "تحديد التاريخ"}</span></button>
            {conflictMessage && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground"><span>{conflictMessage}</span><button type="button" onClick={() => setShowDateEditor(true)} className="rounded-lg bg-background px-3 py-1.5 text-xs font-bold text-primary shadow-sm">تغيير التاريخ</button></div>}
            <div className="mt-3 grid gap-2 rounded-xl bg-muted/45 p-3 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">الميلادي</p><p className="mt-1 font-semibold">{dualDate.gregorian}</p></div><div><p className="text-xs text-muted-foreground">الهجري</p><p className="mt-1 font-semibold text-primary">{dualDate.hijri}</p></div></div>
            {showDateEditor && <div className="mt-3 space-y-3 border-t border-border pt-3"><div className="rounded-2xl border border-border p-2"><Calendar mode="single" selected={scheduledAt} onSelect={(next) => { if (!next) return; const date = new Date(next); date.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0); setScheduledAt(date); setHijriDraft(getHijriDateParts(date) ?? hijriDraft); onClearConflict?.(); }} className="mx-auto" /></div><label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><Clock3 className="h-4 w-4 text-primary" />التاريخ والوقت الميلادي</span><input type="datetime-local" value={toDateTimeLocal(scheduledAt)} onChange={(event) => { const next = new Date(event.target.value); if (!Number.isNaN(next.getTime())) { setScheduledAt(next); setHijriDraft(getHijriDateParts(next) ?? hijriDraft); onClearConflict?.(); } }} className="tarteel-input" /></label><div className="rounded-2xl border border-border bg-muted/30 p-3"><p className="mb-2 text-sm font-semibold">إدخال هجري يدوي</p><div className="grid grid-cols-3 gap-2"><label><span className="mb-1 block text-xs text-muted-foreground">اليوم</span><input dir="ltr" inputMode="numeric" value={hijriDraft.day} onChange={(event) => setHijriDraft({ ...hijriDraft, day: Number(event.target.value) || 0 })} className="tarteel-input text-center" /></label><label><span className="mb-1 block text-xs text-muted-foreground">الشهر</span><input dir="ltr" inputMode="numeric" value={hijriDraft.month} onChange={(event) => setHijriDraft({ ...hijriDraft, month: Number(event.target.value) || 0 })} className="tarteel-input text-center" /></label><label><span className="mb-1 block text-xs text-muted-foreground">السنة</span><input dir="ltr" inputMode="numeric" value={hijriDraft.year} onChange={(event) => setHijriDraft({ ...hijriDraft, year: Number(event.target.value) || 0 })} className="tarteel-input text-center" /></label></div><button type="button" onClick={() => { const date = hijriToGregorian(hijriDraft); if (!date) { toast.error("التاريخ الهجري غير صالح"); return; } date.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0); setScheduledAt(date); onClearConflict?.(); }} className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">تطبيق التاريخ الهجري</button></div></div>}
          </section>

          <label className="block"><span className="mb-1.5 block text-sm font-semibold">ملاحظات</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="ملاحظات إضافية حول أهداف الجلسة أو توجيهاتها…" className="tarteel-input resize-none" /></label>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row"><button type="button" onClick={resetAndClose} className="rounded-xl border border-border px-5 py-3 font-semibold hover:bg-muted">إلغاء</button><button type="button" disabled={isLoading} onClick={submit} className="btn-gold flex-1 py-3">{isLoading ? "جارٍ إنشاء الفترة…" : "إنشاء الفترة وفتح سجل الطلاب"}</button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
