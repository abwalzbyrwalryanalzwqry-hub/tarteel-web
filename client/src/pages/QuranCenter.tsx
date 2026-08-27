import { VisualMushafReader } from "@/components/VisualMushafReader";
import { readMushafSelectionContext } from "@/lib/mushafSelection";
import { loadQuranReadingProgress } from "@/lib/quranReadingProgress";
import { Input } from "@/components/ui/input";
import { QURAN_SURAHS } from "../../../shared/types";
import { TANZIL_UTHMANI_SOURCE_URL, loadQuranVerses, searchQuranVerses, type QuranVerse } from "../../../shared/quran";
import { BookOpenText, ChevronLeft, ExternalLink, Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

function getSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const surah = Number(params.get("surah"));
  const ayah = Number(params.get("ayah"));
  return {
    surah: QURAN_SURAHS.some((item) => item.number === surah) ? surah : 1,
    ayah: ayah > 0 ? ayah : 1,
    token: params.get("mushafToken"),
  };
}

export default function QuranCenter() {
  const initial = useMemo(getSearchParams, []);
  const selectionContext = useMemo(() => readMushafSelectionContext(initial.token), [initial.token]);
  const [mode, setMode] = useState<"visual" | "text">("visual");
  const [lastReadProgress] = useState(() => loadQuranReadingProgress());
  const lastReadPage = lastReadProgress?.page ?? null;
  const lastReadSurah = lastReadProgress?.surah ? QURAN_SURAHS.find((surah) => surah.number === lastReadProgress.surah) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6" dir="rtl">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-l from-primary/10 via-card to-emerald-500/10 p-6 lg:p-8">
        <div className="absolute -top-16 -left-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gold-gradient shadow-lg"><BookOpenText className="h-7 w-7 text-white" /></div>
            <div><h1 className="font-display text-3xl font-bold text-foreground">مركز القرآن</h1><p className="mt-1 text-sm leading-7 text-muted-foreground">مصحف المدينة المرئي بصفحات كاملة، مع قراءة نصية مرجعية وبحث اختياري.</p></div>
          </div>
          {!selectionContext && <div className="flex w-full flex-col gap-2 lg:w-auto"><Link href={lastReadPage ? `/quran/read?page=${lastReadPage}` : "/quran/read"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 active:scale-[0.97]"><BookOpenText className="h-4 w-4" />{lastReadPage ? lastReadSurah && lastReadProgress?.ayah ? `متابعة القراءة · ${lastReadSurah.name} ${lastReadProgress.ayah} · ص ${lastReadPage}` : `متابعة القراءة · صفحة ${lastReadPage}` : "بدء قراءة القرآن"}</Link>{lastReadPage && <p className="text-center text-xs font-medium text-muted-foreground">حُفظ آخر موضع لك تلقائياً.</p>}<div className="flex rounded-xl bg-background/70 p-1 shadow-sm"><button type="button" onClick={() => setMode("visual")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === "visual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>المصحف المرئي</button><button type="button" onClick={() => setMode("text")} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === "text" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>النص والبحث</button></div></div>}
        </div>
      </section>

      {mode === "visual" || selectionContext ? <VisualMushafReader startSurah={initial.surah} startAyah={initial.ayah} selectionContext={selectionContext} /> : <QuranTextReference initialSurah={initial.surah} initialAyah={initial.ayah} />}
    </div>
  );
}

function QuranTextReference({ initialSurah, initialAyah }: { initialSurah: number; initialAyah: number }) {
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [selectedSurah, setSelectedSurah] = useState(initialSurah);
  const [selectedAyah, setSelectedAyah] = useState<number | undefined>(initialAyah);
  const [query, setQuery] = useState("");
  const [fontScale, setFontScale] = useState<"compact" | "comfortable" | "large">("comfortable");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadQuranVerses().then((data) => active && setVerses(data)).catch(() => active && toast.error("تعذر تحميل النص العثماني حالياً. تحقق من الاتصال ثم أعد المحاولة.")).finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, []);

  const currentSurah = QURAN_SURAHS.find((surah) => surah.number === selectedSurah) ?? QURAN_SURAHS[0];
  const displayedVerses = query.trim() ? searchQuranVerses(verses, query) : verses.filter((verse) => verse.surah === selectedSurah);
  const textSize = fontScale === "compact" ? "quran-text--compact" : fontScale === "large" ? "quran-text--large" : "";
  const selectVerse = (verse: QuranVerse) => { setSelectedSurah(verse.surah); setSelectedAyah(verse.ayah); if (query) setQuery(""); };

  return <div className="grid gap-6 xl:grid-cols-[285px_minmax(0,1fr)]">
    <aside className="glass-card rounded-2xl p-4 xl:sticky xl:top-6 xl:h-[calc(100vh-8rem)] xl:overflow-y-auto"><div className="mb-4 flex items-center justify-between"><h2 className="font-display font-bold text-foreground">فهرس السور</h2><span className="text-xs text-muted-foreground">114 سورة</span></div><div className="space-y-1.5">{QURAN_SURAHS.map((surah) => <button key={surah.number} type="button" onClick={() => { setSelectedSurah(surah.number); setSelectedAyah(undefined); setQuery(""); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors ${selectedSurah === surah.number && !query ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-foreground"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${selectedSurah === surah.number && !query ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>{surah.number}</span><span className="flex-1 text-sm font-medium">{surah.name}</span><span className={`text-xs ${selectedSurah === surah.number && !query ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{surah.ayahs}</span></button>)}</div></aside>
    <main className="space-y-4"><div className="glass-card rounded-2xl p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-primary">{query ? "نتائج البحث في المصحف" : `السورة ${currentSurah?.number}`}</p><h2 className="font-display text-2xl font-bold text-foreground">{query ? `نتائج: «${query}»` : currentSurah?.name}</h2></div><div className="flex items-center gap-2 rounded-xl bg-muted/40 p-1"><SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />{(["compact", "comfortable", "large"] as const).map((scale) => <button type="button" key={scale} onClick={() => setFontScale(scale)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${fontScale === scale ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{scale === "compact" ? "صغير" : scale === "large" ? "كبير" : "مريح"}</button>)}</div></div><div className="relative mt-4"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بكلمة من القرآن..." className="pr-10" /></div></div>
      <article translate="no" lang="ar" className="glass-card min-h-[520px] rounded-3xl p-5 sm:p-8">{isLoading ? <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span>جارٍ تجهيز النص العثماني...</span></div> : displayedVerses.length === 0 ? <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center"><Sparkles className="h-8 w-8 text-primary" /><p className="font-display text-lg font-bold text-foreground">لا توجد نتائج مطابقة</p><p className="text-sm text-muted-foreground">جرّب كلمة أخرى أو اختر سورة من الفهرس.</p></div> : <div className="space-y-4">{!query && <div className="quran-text quran-text--compact mx-auto mb-8 max-w-2xl rounded-2xl bg-primary/5 px-5 py-4 text-center text-primary">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>}{displayedVerses.map((verse) => <button type="button" key={`${verse.surah}-${verse.ayah}`} onClick={() => selectVerse(verse)} className={`block w-full rounded-2xl border px-4 py-4 text-right transition-all ${selectedAyah === verse.ayah && selectedSurah === verse.surah ? "border-primary bg-primary/10 shadow-sm" : "border-transparent hover:border-primary/20 hover:bg-muted/30"}`}>{query && <span className="mb-2 flex items-center gap-2 text-xs text-primary"><ChevronLeft className="h-3.5 w-3.5" />{QURAN_SURAHS.find((surah) => surah.number === verse.surah)?.name} — آية {verse.ayah}</span>}<span className={`quran-text text-foreground ${textSize}`}>{verse.text}</span><span className="mr-3 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-1.5 align-middle text-xs font-bold text-primary">{verse.ayah}</span></button>)}</div>}</article><a href={TANZIL_UTHMANI_SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-2 text-xs leading-6 text-muted-foreground hover:text-primary">مصدر النص العثماني للقراءة والبحث: Tanzil <ExternalLink className="h-3.5 w-3.5" /></a></main>
  </div>;
}
