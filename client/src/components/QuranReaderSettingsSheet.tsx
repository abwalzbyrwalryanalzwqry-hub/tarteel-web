import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { QuranReaderPreferences, ReaderStudyFont, ReaderTextScale } from "@/lib/quranReaderPreferences";
import { Moon, Settings2, Sun, Type, Lightbulb } from "lucide-react";

interface QuranReaderSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: QuranReaderPreferences;
  onChange: (next: QuranReaderPreferences) => void;
  screenWakeLockSupported?: boolean;
}

function ChoiceGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <div><p className="mb-2 text-sm font-bold text-foreground">{label}</p><div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/55 p-1.5">{options.map((option) => <Button key={option.value} type="button" variant={value === option.value ? "default" : "ghost"} className="px-2 text-xs" onClick={() => onChange(option.value)}>{option.label}</Button>)}</div></div>;
}

export function QuranReaderSettingsSheet({ open, onOpenChange, preferences, onChange, screenWakeLockSupported = false }: QuranReaderSettingsSheetProps) {
  const update = <K extends keyof QuranReaderPreferences>(key: K, value: QuranReaderPreferences[K]) => onChange({ ...preferences, [key]: value });
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" dir="rtl" className={`rounded-t-[2rem] p-0 ${preferences.darkMode ? "reader-sheet-dark" : ""}`}>
      <SheetHeader className="border-b border-border/60 bg-primary/5 px-5 pb-4 pt-6 text-right"><SheetTitle className="flex items-center gap-2 font-display text-xl text-foreground"><Settings2 className="h-5 w-5 text-primary" />إعدادات القراءة</SheetTitle><SheetDescription>تُحفظ هذه التفضيلات على هذا الجهاز للقراءة التالية.</SheetDescription></SheetHeader>
      <div className="space-y-5 p-5"><button type="button" onClick={() => update("darkMode", !preferences.darkMode)} className="flex w-full items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-right"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">{preferences.darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}</span><span className="flex-1"><span className="block font-bold text-foreground">وضع القراءة الليلي</span><span className="mt-1 block text-xs text-muted-foreground">خلفية هادئة وأدوات أقل وهجاً.</span></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${preferences.darkMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{preferences.darkMode ? "مفعّل" : "غير مفعّل"}</span></button><button type="button" disabled={!screenWakeLockSupported} onClick={() => update("keepScreenAwake", !preferences.keepScreenAwake)} className="flex w-full items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-right disabled:cursor-not-allowed disabled:opacity-60"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Lightbulb className="h-5 w-5" /></span><span className="flex-1"><span className="block font-bold text-foreground">إبقاء الشاشة مستيقظة</span><span className="mt-1 block text-xs text-muted-foreground">يمنع إطفاء الشاشة أثناء القراءة فقط عند دعم المتصفح.</span></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${preferences.keepScreenAwake && screenWakeLockSupported ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{!screenWakeLockSupported ? "غير مدعوم" : preferences.keepScreenAwake ? "مفعّل" : "غير مفعّل"}</span></button><div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-right"><p className="font-bold text-foreground">عرض صفحة المصحف</p><p className="mt-1 text-xs leading-6 text-muted-foreground">تُضبط الصفحة تلقائياً إلى أكبر مساحة آمنة ممكنة مع ظهورها كاملة وبنسبتها الأصلية، من دون قص أو تمديد.</p></div><ChoiceGroup<ReaderTextScale> label="حجم نص الشروح" value={preferences.textScale} onChange={(value) => update("textScale", value)} options={[{ value: "small", label: "صغير" }, { value: "comfortable", label: "مريح" }, { value: "large", label: "كبير" }]} /><div><p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><Type className="h-4 w-4 text-primary" />خط الشروح والمعاني</p><div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/55 p-1.5"><Button type="button" variant={preferences.studyFont === "sans" ? "default" : "ghost"} onClick={() => update("studyFont", "sans")}>واضح</Button><Button type="button" className="font-serif" variant={preferences.studyFont === "serif" ? "default" : "ghost"} onClick={() => update("studyFont", "serif")}>نسخي</Button></div></div><p className="rounded-xl border border-border/60 bg-muted/35 p-3 text-xs leading-6 text-muted-foreground">يُعرض رسم المصحف العثماني المعتمد كما هو حفاظاً على دقته، وتطبق تفضيلات الخط والحجم على واجهة القراءة والشروح فقط.</p></div>
    </SheetContent>
  </Sheet>;
}
