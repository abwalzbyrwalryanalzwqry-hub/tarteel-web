import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { loadQuranStudyPage, type QuranStudyPage, type QuranStudyVerse } from "@/lib/tafsirContent";
import type { ReaderStudyFont, ReaderTextScale } from "@/lib/quranReaderPreferences";
import { BookOpenText, Languages, Loader2, MessageCircleMore } from "lucide-react";
import { useEffect, useState } from "react";

type StudyMode = "tafsir" | "translation";

interface QuranStudySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageNumber: number;
  surahNumber: number | null;
  ayahNumber: number | null;
  textScale?: ReaderTextScale;
  studyFont?: ReaderStudyFont;
  darkMode?: boolean;
}

export function QuranStudySheet({ open, onOpenChange, pageNumber, surahNumber, ayahNumber, textScale = "comfortable", studyFont = "sans", darkMode = false }: QuranStudySheetProps) {
  const [data, setData] = useState<QuranStudyPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StudyMode>("tafsir");
  const [activeMeaning, setActiveMeaning] = useState<string | null>(null);
  const verseKey = surahNumber && ayahNumber ? `${surahNumber}:${ayahNumber}` : null;
  const verse: QuranStudyVerse | null = verseKey ? data?.verses[verseKey] ?? null : null;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setData(null);
    setError(null);
    setActiveMeaning(null);
    loadQuranStudyPage(pageNumber).then((result) => active && setData(result)).catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "تعذر تحميل المحتوى الموثق."));
    return () => { active = false; };
  }, [open, pageNumber, verseKey]);

  const textSizeClass = textScale === "small" ? "text-sm" : textScale === "large" ? "text-lg" : "text-base";
  const fontClass = studyFont === "serif" ? "font-serif" : "";

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="bottom" dir="rtl" overlayClassName="quran-study-overlay" className={`quran-study-sheet max-h-[82svh] rounded-t-[2rem] p-0 ${darkMode ? "reader-sheet-dark" : ""}`}>
      <SheetHeader className="border-b border-border/60 bg-primary/5 px-5 pb-4 pt-6 text-right"><SheetTitle className="flex items-center gap-2 font-display text-xl text-foreground"><BookOpenText className="h-5 w-5 text-primary" />فهم الآية</SheetTitle><SheetDescription>السورة {surahNumber} · الآية {ayahNumber} · اضغط الكلمة لإظهار معناها.</SheetDescription></SheetHeader>
      <div className={`max-h-[calc(82svh-7rem)] overflow-y-auto p-5 ${fontClass}`}>
        {error ? <p className="rounded-2xl bg-destructive/10 p-4 text-sm leading-7 text-destructive">{error}</p> : !data || !verse ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />جارٍ تحميل المحتوى الموثق…</div> : <div className="space-y-5"><div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/55 p-1.5"><Button type="button" variant={mode === "tafsir" ? "default" : "ghost"} onClick={() => setMode("tafsir")}><MessageCircleMore className="ml-2 h-4 w-4" />التفسير الميسر</Button><Button type="button" variant={mode === "translation" ? "default" : "ghost"} onClick={() => setMode("translation")}><Languages className="ml-2 h-4 w-4" />الترجمة الإنجليزية</Button></div><article className={`rounded-2xl border border-primary/15 bg-primary/5 p-4 leading-8 text-foreground ${textSizeClass}`}>{mode === "tafsir" ? verse.tafsir : verse.translation}</article><div><div className="mb-3 flex items-center justify-between"><p className="font-display font-bold text-foreground">معاني كلمات الآية</p><span className="text-xs text-muted-foreground">المس كلمة</span></div><div className="flex flex-wrap gap-2">{verse.words.map((word) => <button key={word.number} type="button" onClick={() => setActiveMeaning(word.meaning || "لا يتوفر معنى موثق مستقل لهذه الكلمة.")} className={`rounded-xl border border-primary/15 bg-card px-3 py-2 font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground ${textSizeClass}`}>{word.word}</button>)}</div>{activeMeaning && <div role="status" className={`mt-4 rounded-2xl border border-amber-500/20 bg-amber-50 p-4 leading-8 text-amber-950 ${textSizeClass}`}>{activeMeaning}</div>}</div><p className="border-t border-border/60 pt-4 text-xs leading-6 text-muted-foreground">المصدر: {data.attribution} · الترخيص: {data.license}</p></div>}
      </div>
    </SheetContent>
  </Sheet>;
}
