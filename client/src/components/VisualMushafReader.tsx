import { Button } from "@/components/ui/button";
import { clampMushafPage, findMushafPage, resolveMushafTripleTap, type MushafTapState, type MushafVisualPage, type MushafVisualRegistry } from "../../../shared/mushafVisual";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadMushafVisualRegistry } from "@/lib/mushafVisual";
import type { MushafSelectionContext } from "@/lib/mushafSelection";

interface VisualMushafReaderProps {
  startSurah: number;
  startAyah: number;
  selectionContext?: MushafSelectionContext | null;
}

function getPage(registry: MushafVisualRegistry | null, pageNumber: number) {
  return registry?.pages.find((candidate) => candidate.page === pageNumber) ?? null;
}

export function VisualMushafReader({ startSurah, startAyah, selectionContext }: VisualMushafReaderProps) {
  const [registry, setRegistry] = useState<MushafVisualRegistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [showStartHighlight, setShowStartHighlight] = useState(false);
  const [tapState, setTapState] = useState<MushafTapState | null>(null);
  const [tapHint, setTapHint] = useState("");
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    loadMushafVisualRegistry()
      .then((loaded) => {
        if (!active) return;
        const startPage = findMushafPage(loaded, startSurah, startAyah);
        setRegistry(loaded);
        setPageNumber(startPage?.page ?? 1);
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "تعذر تحميل فهرس صفحات المصحف."));
    return () => { active = false; };
  }, [startSurah, startAyah]);

  useEffect(() => () => {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
  }, []);

  const page = getPage(registry, pageNumber);
  const startIsOnPage = page?.verses.some(([surah, ayah]) => surah === startSurah && ayah === startAyah) ?? false;
  const startZones = useMemo(() => page?.zones.filter(([surah, ayah]) => surah === startSurah && ayah === startAyah) ?? [], [page, startSurah, startAyah]);

  const setActivePage = (next: number) => {
    setTapState(null);
    setTapHint("");
    setLoadedPage(null);
    setShowStartHighlight(false);
    setPageNumber(clampMushafPage(next));
  };

  const startHighlight = () => {
    if (!startIsOnPage || loadedPage !== pageNumber) return;
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    setShowStartHighlight(true);
    highlightTimer.current = window.setTimeout(() => setShowStartHighlight(false), 3000);
  };

  useEffect(() => {
    if (loadedPage === pageNumber && startIsOnPage) startHighlight();
  // The highlight must restart only when the actual page image finishes loading.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPage, pageNumber, startIsOnPage]);

  const selectVerse = (surah: number, ayah: number) => {
    const resolution = resolveMushafTripleTap(tapState, { surah, ayah }, Date.now());
    setTapState(resolution.state);
    if (!selectionContext) {
      setTapHint(`تم التعرف على الآية ${ayah}. للعودة إلى نموذج التسجيل افتح المصحف من زر الحفظ أو المراجعة.`);
      return;
    }
    if (!resolution.selected) {
      setTapHint(`انقر ثلاث مرات متتالية على الآية لتعيين النهاية (${resolution.state.count}/3).`);
      return;
    }
    const returnUrl = new URL(selectionContext.returnPath, window.location.origin);
    returnUrl.searchParams.set("mushafToken", selectionContext.token);
    returnUrl.searchParams.set("toSurah", String(surah));
    returnUrl.searchParams.set("toAyah", String(ayah));
    window.location.replace(`${returnUrl.pathname}${returnUrl.search}`);
  };

  if (error) {
    return <div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-6 text-center"><p className="font-display text-lg font-bold text-foreground">تعذر فتح صفحات المصحف</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" type="button" onClick={() => window.location.reload()}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button></div>;
  }

  if (!registry || !page) {
    return <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-3xl border border-primary/10 bg-card/60 text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="text-sm">جارٍ تجهيز صفحات المصحف الموثقة…</p></div>;
  }

  return (
    <section className="space-y-4" dir="rtl">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="font-display font-bold text-foreground">مصحف المدينة المرئي</p><p className="mt-1 text-sm text-muted-foreground">صفحة {page.page} من 604{selectionContext ? " · اختر آية النهاية بثلاث نقرات متتالية" : " · قراءة مرجعية موثقة"}</p></div>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-background/80 p-1.5 shadow-sm sm:justify-end">
          <Button type="button" size="sm" variant="ghost" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)}><ChevronRight className="ml-1 h-4 w-4" />السابقة</Button>
          <span className="min-w-16 text-center text-xs font-bold text-primary">{page.page}/604</span>
          <Button type="button" size="sm" variant="ghost" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)}>التالية<ChevronLeft className="mr-1 h-4 w-4" /></Button>
        </div>
      </div>

      {selectionContext && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-foreground">تبدأ من السورة {startSurah}، الآية {startAyah}. تُضاء موضع البداية لمدة ثلاث ثوانٍ عند فتح صفحتها، ثم انقر ثلاث مرات متتالية على آية النهاية للعودة تلقائياً إلى نموذج {selectionContext.kind === "memorization" ? "الحفظ" : "المراجعة"}.</div>}
      {tapHint && <p role="status" aria-live="polite" className="rounded-xl bg-muted/70 px-4 py-3 text-center text-sm text-muted-foreground">{tapHint}</p>}

      <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-[1.6rem] border border-amber-950/15 bg-[#f8f2e2] p-1 shadow-[0_18px_55px_-25px_rgba(57,42,15,0.55)]">
        <div className="relative aspect-[382.68/547.09] w-full select-none">
          <img src={page.url} alt={`صفحة ${page.page} من مصحف المدينة`} draggable={false} onLoad={() => setLoadedPage(page.page)} className="absolute inset-0 h-full w-full" />
          {showStartHighlight && startZones.map(([, , , left, top, width, height], index) => <span key={`start-${index}`} aria-hidden="true" className="mushaf-start-highlight pointer-events-none absolute rounded-[0.2rem]" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${(width / 382.68) * 100}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
          {page.zones.map(([surah, ayah, line, left, top, width, height], index) => <button key={`${surah}-${ayah}-${line}-${index}`} type="button" aria-label={`الآية ${ayah} من السورة ${surah}`} onClick={() => selectVerse(surah, ayah)} className="absolute cursor-pointer rounded-[0.2rem] bg-transparent outline-none focus-visible:bg-primary/25 focus-visible:ring-2 focus-visible:ring-primary/70" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${Math.max((width / 382.68) * 100, 0.5)}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/75 p-3 text-sm">
        <p className="mb-3 text-center text-xs leading-6 text-muted-foreground">المصدر المرخّص: Mushaf Database SVG V1.01. تعرض المنصة صفحة المصحف كما هي ولا تعدّل رسمها أو نصها.</p>
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)}><ChevronRight className="ml-1 h-4 w-4" />صفحة سابقة</Button>
          <Button type="button" variant="outline" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)}>صفحة تالية<ChevronLeft className="mr-1 h-4 w-4" /></Button>
        </div>
      </div>
    </section>
  );
}
