import { Button } from "@/components/ui/button";
import { MushafIndexSheet } from "@/components/MushafIndexSheet";
import { QuranStudySheet } from "@/components/QuranStudySheet";
import { QuranReaderSettingsSheet } from "@/components/QuranReaderSettingsSheet";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { loadQuranReaderPreferences, saveQuranReaderPreferences, type QuranReaderPreferences } from "@/lib/quranReaderPreferences";
import { clampMushafPage, findMushafPage, resolveMushafSwipeDirection, resolveMushafTripleTap, type MushafTapState, type MushafVisualManifest, type MushafVisualPageData } from "../../../shared/mushafVisual";
import { Bookmark, BookmarkCheck, BookmarkPlus, ChevronLeft, ChevronRight, Info, ListTree, Loader2, Maximize2, Minimize2, RefreshCw, Settings2, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadMushafVisualManifest, loadMushafVisualPage } from "@/lib/mushafVisual";
import type { MushafSelectionContext } from "@/lib/mushafSelection";

interface VisualMushafReaderProps {
  startSurah: number;
  startAyah: number;
  selectionContext?: MushafSelectionContext | null;
  focusMode?: boolean;
  onClose?: () => void;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

type PointerStart = { id: number; x: number; y: number } | null;

function getPage(manifest: MushafVisualManifest | null, pageNumber: number) {
  return manifest?.pages[pageNumber - 1] ?? null;
}

export function VisualMushafReader({ startSurah, startAyah, selectionContext, focusMode = false, onClose, initialPage, onPageChange }: VisualMushafReaderProps) {
  const [manifest, setManifest] = useState<MushafVisualManifest | null>(null);
  const [pageData, setPageData] = useState<MushafVisualPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(() => initialPage ? clampMushafPage(initialPage) : 1);
  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [showStartHighlight, setShowStartHighlight] = useState(false);
  const [highlightKey, setHighlightKey] = useState(0);
  const [tapState, setTapState] = useState<MushafTapState | null>(null);
  const [tapHint, setTapHint] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [pageMotion, setPageMotion] = useState<"next" | "previous" | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<{ surah: number; ayah: number } | null>(null);
  const [studyVerse, setStudyVerse] = useState<{ surah: number; ayah: number; page: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readerPreferences, setReaderPreferences] = useState<QuranReaderPreferences>(() => loadQuranReaderPreferences());
  const highlightTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTarget = useRef<{ x: number; y: number } | null>(null);
  const swipeCommitTimer = useRef<number | null>(null);
  const pointerStart = useRef<PointerStart>(null);
  const suppressVerseClick = useRef(false);
  const focusRoot = useRef<HTMLElement>(null);
  const { isAuthenticated } = useAuth();
  const trpcUtils = trpc.useUtils();
  const { data: bookmarks = [] } = trpc.quranBookmarks.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveBookmark = trpc.quranBookmarks.save.useMutation({ onSuccess: () => void trpcUtils.quranBookmarks.list.invalidate() });
  const removeBookmark = trpc.quranBookmarks.remove.useMutation({ onSuccess: () => void trpcUtils.quranBookmarks.list.invalidate() });

  useEffect(() => {
    let active = true;
    loadMushafVisualManifest().then((loaded) => {
      if (!active) return;
      const startPage = findMushafPage(loaded, startSurah, startAyah);
      setManifest(loaded);
      setPageNumber(initialPage ? clampMushafPage(initialPage) : startPage?.page ?? 1);
    }).catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "تعذر تحميل فهرس صفحات المصحف."));
    return () => { active = false; };
  }, [initialPage, startSurah, startAyah]);

  useEffect(() => () => {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    if (swipeCommitTimer.current) window.clearTimeout(swipeCommitTimer.current);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setBrowserFullscreen(document.fullscreenElement === focusRoot.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => { saveQuranReaderPreferences(readerPreferences); }, [readerPreferences]);

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
    setSelectedVerse(null);
    setStudyVerse(null);
    setTapHint("");
    setLoadedPage(null);
    setShowStartHighlight(false);
    setSwipeOffset(0);
    setIsSwiping(false);
    setPageMotion(target > pageNumber ? "next" : "previous");
    setPageNumber(target);
    window.setTimeout(() => setPageMotion(null), 240);
  };

  useEffect(() => { onPageChange?.(pageNumber); }, [onPageChange, pageNumber]);

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
      setSelectedVerse({ surah, ayah });
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

  const clearLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressTarget.current = null;
  };

  const handleVersePointerDown = (event: React.PointerEvent<HTMLButtonElement>, surah: number, ayah: number) => {
    if (selectionContext) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPress();
    longPressTarget.current = { x: event.clientX, y: event.clientY };
    longPressTimer.current = window.setTimeout(() => {
      suppressVerseClick.current = true;
      setTapState(null);
      setStudyVerse({ surah, ayah, page: pageNumber });
      setHint("عرض التفسير ومعاني الكلمات.");
      clearLongPress();
    }, 560);
  };

  const handleVersePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = longPressTarget.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) clearLongPress();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setSwipeOffset(0);
    setIsSwiping(false);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // أحداث الاختبار الاصطناعية لا تملك دائماً مؤشراً نشطاً لالتقاطه.
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) return;
    setIsSwiping(true);
    setSwipeOffset(Math.max(-82, Math.min(82, deltaX * 0.42)));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const direction = resolveMushafSwipeDirection(deltaX, deltaY);
    if (!direction) {
      setSwipeOffset(0);
      setIsSwiping(false);
      return;
    }
    suppressVerseClick.current = true;
    window.setTimeout(() => { suppressVerseClick.current = false; }, 0);
    setIsSwiping(false);
    setSwipeOffset(direction > 0 ? -44 : 44);
    if (swipeCommitTimer.current) window.clearTimeout(swipeCommitTimer.current);
    swipeCommitTimer.current = window.setTimeout(() => setActivePage(pageNumber + direction), 110);
  };

  const handlePointerCancel = () => { pointerStart.current = null; setSwipeOffset(0); setIsSwiping(false); };
  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await focusRoot.current?.requestFullscreen();
    } catch {
      setHint("لا يدعم المتصفح وضع ملء الشاشة في هذه اللحظة.");
    }
  };
  const hasBookmark = (referenceKey: string) => bookmarks.some((bookmark) => bookmark.referenceKey === referenceKey);
  const togglePageBookmark = async () => {
    if (!isAuthenticated) { setHint("سجّل الدخول لحفظ هذه العلامة المرجعية في حسابك."); return; }
    const existing = hasBookmark(`page:${pageNumber}`);
    try {
      if (existing) await removeBookmark.mutateAsync({ referenceType: "page", pageNumber });
      else await saveBookmark.mutateAsync({ referenceType: "page", pageNumber });
      setHint(existing ? "أزيلت علامة الصفحة." : "حُفظت علامة الصفحة.");
    } catch { setHint("تعذر تحديث العلامة المرجعية. حاول مجدداً."); }
  };
  const toggleVerseBookmark = async () => {
    if (!selectedVerse) return;
    if (!isAuthenticated) { setHint("سجّل الدخول لحفظ هذه العلامة المرجعية في حسابك."); return; }
    const referenceKey = `ayah:${selectedVerse.surah}:${selectedVerse.ayah}`;
    const existing = hasBookmark(referenceKey);
    try {
      if (existing) await removeBookmark.mutateAsync({ referenceType: "ayah", pageNumber, surahNumber: selectedVerse.surah, ayahNumber: selectedVerse.ayah });
      else await saveBookmark.mutateAsync({ referenceType: "ayah", pageNumber, surahNumber: selectedVerse.surah, ayahNumber: selectedVerse.ayah });
      setHint(existing ? "أزيلت علامة الآية." : "حُفظت علامة الآية.");
    } catch { setHint("تعذر تحديث العلامة المرجعية. حاول مجدداً."); }
  };

  if (error) {
    return <div className="flex min-h-[100svh] items-center justify-center bg-background p-5" dir="rtl"><div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-6 text-center"><p className="font-display text-lg font-bold text-foreground">تعذر فتح صفحات المصحف</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" type="button" onClick={() => window.location.reload()}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button></div></div>;
  }

  if (!manifest || !page) {
    return <div className={focusMode ? "flex min-h-[100svh] flex-col items-center justify-center gap-3 bg-background text-muted-foreground" : "flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-3xl border border-primary/10 bg-card/60 text-muted-foreground"} dir="rtl"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="text-sm">جارٍ فتح صفحة المصحف…</p></div>;
  }

  const pageCanvas = <div className={`relative select-none overflow-hidden rounded-[1.45rem] border border-amber-950/15 bg-[#f8f2e2] p-1 shadow-[0_18px_55px_-25px_rgba(57,42,15,0.55)] mushaf-page-scale-${readerPreferences.pageScale} ${focusMode ? "mushaf-focus-page" : "mx-auto w-full max-w-[760px]"} ${isSwiping ? "mushaf-page-is-swiping" : ""}`} style={{ transform: swipeOffset ? `translate3d(${swipeOffset}px, 0, 0)` : undefined }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}>
    <div className={`mushaf-page-artwork relative aspect-[382.68/547.09] w-full ${pageMotion ? pageMotion === "next" ? "mushaf-page-enter-next" : "mushaf-page-enter-previous" : ""}`}>
      <img key={page.page} src={page.url} alt={`صفحة ${page.page} من مصحف المدينة`} draggable={false} decoding="async" onLoad={() => setLoadedPage(page.page)} className="absolute inset-0 h-full w-full" />
      {showStartHighlight && startZones.map(([, , , left, top, width, height], index) => <span key={`start-${highlightKey}-${index}`} aria-hidden="true" className="mushaf-start-highlight pointer-events-none absolute rounded-[0.2rem]" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${(width / 382.68) * 100}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
      {(pageData?.zones ?? []).map(([surah, ayah, line, left, top, width, height], index) => <button data-ayah-zone key={`${surah}-${ayah}-${line}-${index}`} type="button" aria-label={`الآية ${ayah} من السورة ${surah}`} onPointerDown={(event) => handleVersePointerDown(event, surah, ayah)} onPointerMove={handleVersePointerMove} onPointerUp={clearLongPress} onPointerCancel={clearLongPress} onClick={() => selectVerse(surah, ayah)} className="absolute cursor-pointer rounded-[0.2rem] bg-transparent outline-none focus-visible:bg-primary/25 focus-visible:ring-2 focus-visible:ring-primary/70" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${Math.max((width / 382.68) * 100, 0.5)}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
    </div>
  </div>;

  if (focusMode) {
    return <section ref={focusRoot} className={`relative h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(225,198,118,0.2),_transparent_38%),linear-gradient(135deg,#f7f3e9,#e8efe7)] ${readerPreferences.darkMode ? "mushaf-dark" : ""}`} dir="rtl">
      <div className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
        <button type="button" onClick={onClose} aria-label="إغلاق المصحف والعودة" className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm backdrop-blur"><X className="h-5 w-5" /></button>
        <div className="rounded-full border border-amber-900/10 bg-white/90 px-3 py-2 text-xs font-bold text-primary shadow-sm backdrop-blur">{page.page}/604</div>
        <span aria-hidden="true" className="h-10 w-10" />
      </div>

      <button type="button" onClick={() => setShowInfo((current) => !current)} aria-expanded={showInfo} aria-controls="mushaf-info-panel" aria-label={showInfo ? "إخفاء بيانات المصحف" : "إظهار بيانات المصحف"} className={`mushaf-info-fab absolute left-4 top-16 z-30 flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-bold backdrop-blur ${showInfo ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_28px_-12px_rgba(9,79,58,0.75)]" : "border-amber-900/15 bg-white/95 text-primary shadow-[0_12px_28px_-14px_rgba(57,42,15,0.6)]"}`}><Info className="h-5 w-5" /><span>البيانات</span></button>
      <div id="mushaf-info-panel" aria-hidden={!showInfo} className={`mushaf-info-panel absolute left-4 top-32 z-20 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-primary/15 bg-white/95 p-4 text-right text-xs leading-6 text-muted-foreground shadow-xl backdrop-blur ${showInfo ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-3 scale-[0.97] opacity-0"}`}>{selectionContext ? `ابدأ من الآية ${startAyah}، ثم انقر ثلاث مرات متتالية على آية النهاية للعودة إلى نموذج ${selectionContext.kind === "memorization" ? "الحفظ" : "المراجعة"}.` : "مصحف المدينة المرئي بصفحات كاملة. اسحب أفقياً للتقليب بين الصفحات."}</div>
      <button type="button" onClick={() => setIndexOpen(true)} aria-label="فتح فهرس المصحف" className="mushaf-index-fab absolute right-4 top-16 z-30 flex h-12 items-center gap-2 rounded-full border border-amber-900/15 bg-white/95 px-4 text-sm font-bold text-primary shadow-[0_12px_28px_-14px_rgba(57,42,15,0.6)] backdrop-blur"><ListTree className="h-5 w-5" /><span>الفهرس</span></button>
      <button type="button" onClick={() => void toggleBrowserFullscreen()} aria-label={browserFullscreen ? "إنهاء وضع ملء الشاشة" : "تفعيل وضع ملء الشاشة"} className="absolute right-5 top-32 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/95 text-primary shadow-sm backdrop-blur"><span className="sr-only">{browserFullscreen ? "إنهاء وضع ملء الشاشة" : "تفعيل وضع ملء الشاشة"}</span>{browserFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
      <button type="button" onClick={() => setSettingsOpen(true)} aria-label="إعدادات القراءة" className="mushaf-settings-fab absolute right-5 top-44 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/95 text-primary shadow-sm backdrop-blur"><Settings2 className="h-4 w-4" /></button>
      <div className="absolute inset-0 grid place-items-center p-0">{pageCanvas}</div>
      {!selectionContext && selectedVerse && <button type="button" onClick={() => void toggleVerseBookmark()} className="absolute bottom-5 right-5 z-20 flex items-center gap-2 rounded-full border border-amber-900/15 bg-white/95 px-4 py-2.5 text-sm font-bold text-primary shadow-lg backdrop-blur"><Bookmark className="h-4 w-4" />{hasBookmark(`ayah:${selectedVerse.surah}:${selectedVerse.ayah}`) ? "إزالة علامة الآية" : `حفظ الآية ${selectedVerse.ayah}`}</button>}
      <button type="button" onClick={() => void togglePageBookmark()} aria-label={hasBookmark(`page:${pageNumber}`) ? "إزالة علامة الصفحة المرجعية" : "حفظ علامة الصفحة المرجعية"} className={`absolute bottom-5 left-5 z-20 flex h-11 items-center justify-center rounded-full border shadow-lg backdrop-blur ${hasBookmark(`page:${pageNumber}`) ? "border-primary bg-primary text-primary-foreground" : "border-amber-900/15 bg-white/95 text-primary"}`}>{hasBookmark(`page:${pageNumber}`) ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}</button>
      {tapHint && <p role="status" aria-live="polite" className="absolute inset-x-4 bottom-5 z-20 mx-auto w-fit rounded-full bg-emerald-950/90 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">{tapHint}</p>}
      <button type="button" aria-label="الصفحة السابقة" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)} className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm disabled:opacity-35"><ChevronRight className="h-5 w-5" /></button>
      <button type="button" aria-label="الصفحة التالية" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)} className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm disabled:opacity-35"><ChevronLeft className="h-5 w-5" /></button>
      <MushafIndexSheet open={indexOpen} onOpenChange={setIndexOpen} manifest={manifest} currentPage={page.page} onPageSelect={setActivePage} bookmarks={bookmarks} onBookmarkRemove={(bookmark) => void removeBookmark.mutateAsync(bookmark.referenceType === "page" ? { referenceType: "page", pageNumber: bookmark.pageNumber } : { referenceType: "ayah", pageNumber: bookmark.pageNumber, surahNumber: bookmark.surahNumber ?? undefined, ayahNumber: bookmark.ayahNumber ?? undefined })} />
      <QuranStudySheet open={Boolean(studyVerse)} onOpenChange={(open) => !open && setStudyVerse(null)} pageNumber={studyVerse?.page ?? page.page} surahNumber={studyVerse?.surah ?? null} ayahNumber={studyVerse?.ayah ?? null} textScale={readerPreferences.textScale} studyFont={readerPreferences.studyFont} darkMode={readerPreferences.darkMode} />
      <QuranReaderSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} preferences={readerPreferences} onChange={setReaderPreferences} />
    </section>;
  }

  return <section className="space-y-4" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-display font-bold text-foreground">مصحف المدينة المرئي</p><p className="mt-1 text-sm text-muted-foreground">صفحة {page.page} من 604 · اسحب أفقياً للتقليب</p></div></div><div className="flex items-center justify-between gap-2 rounded-xl bg-background/80 p-1.5 shadow-sm"><Button type="button" size="sm" variant="ghost" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)}><ChevronRight className="ml-1 h-4 w-4" />السابقة</Button><span className="min-w-16 text-center text-xs font-bold text-primary">{page.page}/604</span><Button type="button" size="sm" variant="ghost" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)}>التالية<ChevronLeft className="mr-1 h-4 w-4" /></Button></div></div>
    {tapHint && <p role="status" aria-live="polite" className="rounded-xl bg-muted/70 px-4 py-3 text-center text-sm text-muted-foreground">{tapHint}</p>}
    {pageCanvas}
  </section>;
}
