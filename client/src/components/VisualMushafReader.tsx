import { Button } from "@/components/ui/button";
import { clampMushafPage, findMushafPage, resolveMushafTripleTap, type MushafTapState, type MushafVisualManifest, type MushafVisualPageData } from "../../../shared/mushafVisual";
import { ChevronLeft, ChevronRight, Info, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadMushafVisualManifest, loadMushafVisualPage } from "@/lib/mushafVisual";
import type { MushafSelectionContext } from "@/lib/mushafSelection";

interface VisualMushafReaderProps {
  startSurah: number;
  startAyah: number;
  selectionContext?: MushafSelectionContext | null;
  focusMode?: boolean;
  onClose?: () => void;
}

type PointerStart = { id: number; x: number; y: number } | null;

function getPage(manifest: MushafVisualManifest | null, pageNumber: number) {
  return manifest?.pages[pageNumber - 1] ?? null;
}

export function VisualMushafReader({ startSurah, startAyah, selectionContext, focusMode = false, onClose }: VisualMushafReaderProps) {
  const [manifest, setManifest] = useState<MushafVisualManifest | null>(null);
  const [pageData, setPageData] = useState<MushafVisualPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [showStartHighlight, setShowStartHighlight] = useState(false);
  const [highlightKey, setHighlightKey] = useState(0);
  const [tapState, setTapState] = useState<MushafTapState | null>(null);
  const [tapHint, setTapHint] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [pageMotion, setPageMotion] = useState<"next" | "previous" | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);
  const pointerStart = useRef<PointerStart>(null);
  const suppressVerseClick = useRef(false);

  useEffect(() => {
    let active = true;
    loadMushafVisualManifest().then((loaded) => {
      if (!active) return;
      const startPage = findMushafPage(loaded, startSurah, startAyah);
      setManifest(loaded);
      setPageNumber(startPage?.page ?? 1);
    }).catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "تعذر تحميل فهرس صفحات المصحف."));
    return () => { active = false; };
  }, [startSurah, startAyah]);

  useEffect(() => () => {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
  }, []);

  const page = getPage(manifest, pageNumber);
  const startIsOnPage = page?.verses.some(([surah, ayah]) => surah === startSurah && ayah === startAyah) ?? false;
  const startZones = useMemo(() => pageData?.zones.filter(([surah, ayah]) => surah === startSurah && ayah === startAyah) ?? [], [pageData, startSurah, startAyah]);

  useEffect(() => {
    if (!manifest || !page) return;
    let active = true;
    setPageData(null);
    loadMushafVisualPage(manifest, page.page).then((data) => active && setPageData(data)).catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "تعذر تحميل مناطق تفاعل الصفحة."));
    return () => { active = false; };
  }, [manifest, page]);

  useEffect(() => {
    if (!manifest) return;
    [pageNumber - 1, pageNumber + 1].forEach((nearbyPage) => {
      const source = getPage(manifest, nearbyPage)?.url;
      if (!source) return;
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      void loadMushafVisualPage(manifest, nearbyPage);
    });
  }, [pageNumber, manifest]);

  const setHint = (message: string) => {
    setTapHint(message);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setTapHint(""), 1800);
  };

  const setActivePage = (next: number) => {
    const target = clampMushafPage(next);
    if (target === pageNumber) return;
    setTapState(null);
    setTapHint("");
    setLoadedPage(null);
    setShowStartHighlight(false);
    setPageMotion(target > pageNumber ? "next" : "previous");
    setPageNumber(target);
    window.setTimeout(() => setPageMotion(null), 240);
  };

  const startHighlight = () => {
    if (!startIsOnPage) return;
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    setHighlightKey((current) => current + 1);
    setShowStartHighlight(true);
    highlightTimer.current = window.setTimeout(() => setShowStartHighlight(false), 3000);
  };

  useEffect(() => {
    if (loadedPage === pageNumber && startIsOnPage) startHighlight();
  // The highlight starts only after the actual image is ready, including cached images.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPage, pageNumber, startIsOnPage]);

  const selectVerse = (surah: number, ayah: number) => {
    if (suppressVerseClick.current) {
      suppressVerseClick.current = false;
      return;
    }
    const resolution = resolveMushafTripleTap(tapState, { surah, ayah }, Date.now(), 900);
    setTapState(resolution.state);
    if (!selectionContext) {
      setHint(`آية ${ayah} من السورة ${surah}`);
      return;
    }
    if (!resolution.selected) {
      setHint(`تأكيد آية النهاية: ${resolution.state.count}/3`);
      return;
    }
    const returnUrl = new URL(selectionContext.returnPath, window.location.origin);
    returnUrl.searchParams.set("mushafToken", selectionContext.token);
    returnUrl.searchParams.set("toSurah", String(surah));
    returnUrl.searchParams.set("toAyah", String(ayah));
    window.location.replace(`${returnUrl.pathname}${returnUrl.search}`);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // أحداث الاختبار الاصطناعية لا تملك دائماً مؤشراً نشطاً لالتقاطه.
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    suppressVerseClick.current = true;
    setActivePage(pageNumber + (deltaX < 0 ? 1 : -1));
  };

  const handlePointerCancel = () => { pointerStart.current = null; };

  if (error) {
    return <div className="flex min-h-[100svh] items-center justify-center bg-background p-5" dir="rtl"><div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-6 text-center"><p className="font-display text-lg font-bold text-foreground">تعذر فتح صفحات المصحف</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" type="button" onClick={() => window.location.reload()}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button></div></div>;
  }

  if (!manifest || !page) {
    return <div className={focusMode ? "flex min-h-[100svh] flex-col items-center justify-center gap-3 bg-background text-muted-foreground" : "flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-3xl border border-primary/10 bg-card/60 text-muted-foreground"} dir="rtl"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="text-sm">جارٍ فتح صفحة المصحف…</p></div>;
  }

  const pageCanvas = <div className={`relative select-none overflow-hidden rounded-[1.45rem] border border-amber-950/15 bg-[#f8f2e2] p-1 shadow-[0_18px_55px_-25px_rgba(57,42,15,0.55)] ${focusMode ? "mushaf-focus-page" : "mx-auto w-full max-w-[760px]"}`} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}>
    <div className={`relative aspect-[382.68/547.09] w-full ${pageMotion ? pageMotion === "next" ? "mushaf-page-enter-next" : "mushaf-page-enter-previous" : ""}`}>
      <img key={page.page} src={page.url} alt={`صفحة ${page.page} من مصحف المدينة`} draggable={false} decoding="async" onLoad={() => setLoadedPage(page.page)} className="absolute inset-0 h-full w-full" />
      {showStartHighlight && startZones.map(([, , , left, top, width, height], index) => <span key={`start-${highlightKey}-${index}`} aria-hidden="true" className="mushaf-start-highlight pointer-events-none absolute rounded-[0.2rem]" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${(width / 382.68) * 100}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
      {(pageData?.zones ?? []).map(([surah, ayah, line, left, top, width, height], index) => <button data-ayah-zone key={`${surah}-${ayah}-${line}-${index}`} type="button" aria-label={`الآية ${ayah} من السورة ${surah}`} onClick={() => selectVerse(surah, ayah)} className="absolute cursor-pointer rounded-[0.2rem] bg-transparent outline-none focus-visible:bg-primary/25 focus-visible:ring-2 focus-visible:ring-primary/70" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${Math.max((width / 382.68) * 100, 0.5)}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
    </div>
  </div>;

  if (focusMode) {
    return <section className="relative h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(225,198,118,0.2),_transparent_38%),linear-gradient(135deg,#f7f3e9,#e8efe7)]" dir="rtl">
      <div className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
        <button type="button" onClick={onClose} aria-label="إغلاق المصحف والعودة" className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm backdrop-blur"><X className="h-5 w-5" /></button>
        <div className="rounded-full border border-amber-900/10 bg-white/90 px-3 py-2 text-xs font-bold text-primary shadow-sm backdrop-blur">{page.page}/604</div>
        <span aria-hidden="true" className="h-10 w-10" />
      </div>

      <button type="button" onClick={() => setShowInfo((current) => !current)} aria-expanded={showInfo} aria-controls="mushaf-info-panel" aria-label={showInfo ? "إخفاء بيانات المصحف" : "إظهار بيانات المصحف"} className={`mushaf-info-fab absolute left-4 top-16 z-30 flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-bold backdrop-blur ${showInfo ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_28px_-12px_rgba(9,79,58,0.75)]" : "border-amber-900/15 bg-white/95 text-primary shadow-[0_12px_28px_-14px_rgba(57,42,15,0.6)]"}`}><Info className="h-5 w-5" /><span>البيانات</span></button>
      <div id="mushaf-info-panel" aria-hidden={!showInfo} className={`mushaf-info-panel absolute left-4 top-32 z-20 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-primary/15 bg-white/95 p-4 text-right text-xs leading-6 text-muted-foreground shadow-xl backdrop-blur ${showInfo ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-3 scale-[0.97] opacity-0"}`}>{selectionContext ? `ابدأ من الآية ${startAyah}، ثم انقر ثلاث مرات متتالية على آية النهاية للعودة إلى نموذج ${selectionContext.kind === "memorization" ? "الحفظ" : "المراجعة"}.` : "مصحف المدينة المرئي بصفحات كاملة. اسحب أفقياً للتقليب بين الصفحات."}</div>
      <div className="absolute inset-0 grid place-items-center p-2">{pageCanvas}</div>
      {tapHint && <p role="status" aria-live="polite" className="absolute inset-x-4 bottom-5 z-20 mx-auto w-fit rounded-full bg-emerald-950/90 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">{tapHint}</p>}
      <button type="button" aria-label="الصفحة السابقة" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)} className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm disabled:opacity-35"><ChevronRight className="h-5 w-5" /></button>
      <button type="button" aria-label="الصفحة التالية" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)} className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm disabled:opacity-35"><ChevronLeft className="h-5 w-5" /></button>
    </section>;
  }

  return <section className="space-y-4" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-display font-bold text-foreground">مصحف المدينة المرئي</p><p className="mt-1 text-sm text-muted-foreground">صفحة {page.page} من 604 · اسحب أفقياً للتقليب</p></div></div><div className="flex items-center justify-between gap-2 rounded-xl bg-background/80 p-1.5 shadow-sm"><Button type="button" size="sm" variant="ghost" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)}><ChevronRight className="ml-1 h-4 w-4" />السابقة</Button><span className="min-w-16 text-center text-xs font-bold text-primary">{page.page}/604</span><Button type="button" size="sm" variant="ghost" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)}>التالية<ChevronLeft className="mr-1 h-4 w-4" /></Button></div></div>
    {tapHint && <p role="status" aria-live="polite" className="rounded-xl bg-muted/70 px-4 py-3 text-center text-sm text-muted-foreground">{tapHint}</p>}
    {pageCanvas}
  </section>;
}
