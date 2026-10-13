import { Button } from "@/components/ui/button";
import { MushafIndexSheet } from "@/components/MushafIndexSheet";
import { QuranStudySheet } from "@/components/QuranStudySheet";
import { QuranReaderSettingsSheet } from "@/components/QuranReaderSettingsSheet";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { loadQuranNavigation } from "@/lib/quranNavigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { loadQuranReaderPreferences, saveQuranReaderPreferences, type QuranReaderPreferences } from "@/lib/quranReaderPreferences";
import { loadQuranVerses } from "../../../shared/quran";
import { clampMushafPage, findMushafPage, resolveMushafSwipeDirection, resolveMushafTripleTap, type MushafTapState, type MushafVisualManifest, type MushafVisualPageData } from "../../../shared/mushafVisual";
import { ArrowRight, Bookmark, BookmarkCheck, BookmarkPlus, Check, ChevronLeft, ChevronRight, Copy, Heart, Info, ListTree, Loader2, Maximize2, MessageSquareText, Minimize2, RefreshCw, RotateCcw, Settings2, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadMushafVisualManifest, loadMushafVisualPage } from "@/lib/mushafVisual";
import type { MushafSelectionContext } from "@/lib/mushafSelection";
import { QURAN_SURAHS } from "../../../shared/types";
import type { QuranNavigationData } from "../../../shared/quranNavigation";

interface VisualMushafReaderProps {
  startSurah: number;
  startAyah: number;
  selectionContext?: MushafSelectionContext | null;
  focusMode?: boolean;
  onClose?: () => void;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onVerseSelect?: (position: { page: number; surah: number; ayah: number }) => void;
}

type PointerStart = { id: number; x: number; y: number } | null;
type ReaderPoint = { x: number; y: number };
type ScreenWakeLock = { release: () => Promise<void> };

const MAX_PAGE_ZOOM = 2.25;
const DOUBLE_TAP_DELAY_MS = 280;

function clampPageZoom(value: number) {
  return Math.max(1, Math.min(MAX_PAGE_ZOOM, value));
}

function distanceBetween([first, second]: ReaderPoint[]) {
  return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
}

function getPage(manifest: MushafVisualManifest | null, pageNumber: number) {
  return manifest?.pages[pageNumber - 1] ?? null;
}

export function VisualMushafReader({ startSurah, startAyah, selectionContext, focusMode = false, onClose, initialPage, onPageChange, onVerseSelect }: VisualMushafReaderProps) {
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
  const [verseActionsOpen, setVerseActionsOpen] = useState(false);
  const [selectedVerseText, setSelectedVerseText] = useState<string | null>(null);
  const [verseTextError, setVerseTextError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [studyVerse, setStudyVerse] = useState<{ surah: number; ayah: number; page: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readerPreferences, setReaderPreferences] = useState<QuranReaderPreferences>(() => loadQuranReaderPreferences());
  const [navigation, setNavigation] = useState<QuranNavigationData | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pageZoom, setPageZoom] = useState(1);
  const [pagePan, setPagePan] = useState<ReaderPoint>({ x: 0, y: 0 });
  const highlightTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTarget = useRef<{ x: number; y: number } | null>(null);
  const swipeCommitTimer = useRef<number | null>(null);
  const controlsTimer = useRef<number | null>(null);
  const pointerStart = useRef<PointerStart>(null);
  const touchPoints = useRef(new Map<number, ReaderPoint>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const panStart = useRef<{ id: number; x: number; y: number; pan: ReaderPoint } | null>(null);
  const lastCanvasTap = useRef(0);
  const suppressVerseClick = useRef(false);
  const focusRoot = useRef<HTMLElement>(null);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);
  const { isAuthenticated } = useAuth();
  const trpcUtils = trpc.useUtils();
  const { data: bookmarks = [] } = trpc.quranBookmarks.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveBookmark = trpc.quranBookmarks.save.useMutation({ onSuccess: () => void trpcUtils.quranBookmarks.list.invalidate() });
  const removeBookmark = trpc.quranBookmarks.remove.useMutation({ onSuccess: () => void trpcUtils.quranBookmarks.list.invalidate() });
  const { data: versePreferences = [] } = trpc.quranVersePreferences.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveVersePreference = trpc.quranVersePreferences.save.useMutation({ onSuccess: () => void trpcUtils.quranVersePreferences.list.invalidate() });

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
    if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setBrowserFullscreen(document.fullscreenElement === focusRoot.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => { saveQuranReaderPreferences(readerPreferences); }, [readerPreferences]);

  const screenWakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  useEffect(() => {
    if (!focusMode || !readerPreferences.keepScreenAwake || !screenWakeLockSupported) return;
    let active = true;
    const requestWakeLock = async () => {
      try {
        const wakeLock = (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<ScreenWakeLock> } }).wakeLock;
        const sentinel = await wakeLock.request("screen");
        if (active) wakeLockRef.current = sentinel;
        else await sentinel.release();
      } catch {
        if (active) setHint("تعذر إبقاء الشاشة مستيقظة في هذه اللحظة.");
      }
    };
    const restoreWhenVisible = () => { if (document.visibilityState === "visible") void requestWakeLock(); };
    void requestWakeLock();
    document.addEventListener("visibilitychange", restoreWhenVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", restoreWhenVisible);
      const current = wakeLockRef.current;
      wakeLockRef.current = null;
      if (current) void current.release().catch(() => undefined);
    };
  }, [focusMode, readerPreferences.keepScreenAwake, screenWakeLockSupported]);

  useEffect(() => {
    if (!focusMode) return;
    let active = true;
    loadQuranNavigation().then((value) => active && setNavigation(value)).catch(() => active && setNavigation(null));
    return () => { active = false; };
  }, [focusMode]);

  const page = getPage(manifest, pageNumber);
  const pageSurahNames = useMemo(() => {
    if (!page) return "القرآن الكريم";
    return Array.from(new Set(page.verses.map(([surah]) => surah))).map((surah) => QURAN_SURAHS.find((item) => item.number === surah)?.name ?? `السورة ${surah}`).join(" · ");
  }, [page]);
  const currentJuz = useMemo(() => navigation?.juz.reduce((current, item) => item.page <= pageNumber ? item : current, navigation.juz[0])?.number ?? null, [navigation, pageNumber]);
  const startIsOnPage = page?.verses.some(([surah, ayah]) => surah === startSurah && ayah === startAyah) ?? false;
  const startZones = useMemo(() => pageData?.zones.filter(([surah, ayah]) => surah === startSurah && ayah === startAyah) ?? [], [pageData, startSurah, startAyah]);
  const selectedVerseKey = selectedVerse ? `ayah:${selectedVerse.surah}:${selectedVerse.ayah}` : null;
  const selectedVersePreference = useMemo(() => selectedVerseKey ? versePreferences.find((item) => item.verseKey === selectedVerseKey) ?? null : null, [selectedVerseKey, versePreferences]);

  useEffect(() => {
    if (!manifest || !page) return;
    let active = true;
    setPageData(null);
    loadMushafVisualPage(manifest, page.page).then((data) => active && setPageData(data)).catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "تعذر تحميل مناطق تفاعل الصفحة."));
    return () => { active = false; };
  }, [manifest, page]);

  useEffect(() => {
    if (!verseActionsOpen || !selectedVerse) return;
    let active = true;
    setSelectedVerseText(null);
    setVerseTextError(null);
    loadQuranVerses().then((verses) => {
      const verse = verses.find((item) => item.surah === selectedVerse.surah && item.ayah === selectedVerse.ayah);
      if (!verse) throw new Error("لم يُعثر على نص الآية في المصدر المرجعي.");
      if (active) setSelectedVerseText(verse.text);
    }).catch((loadError) => active && setVerseTextError(loadError instanceof Error ? loadError.message : "تعذر تحميل نص الآية."));
    return () => { active = false; };
  }, [verseActionsOpen, selectedVerse]);

  useEffect(() => {
    if (!verseActionsOpen) return;
    setNoteDraft(selectedVersePreference?.note ?? "");
  }, [verseActionsOpen, selectedVersePreference?.note]);

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

  const revealControls = () => {
    if (!focusMode) return;
    setControlsVisible(true);
    if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => {
      setShowInfo(false);
      setControlsVisible(false);
    }, 2800);
  };

  useEffect(() => {
    if (!focusMode) return;
    if (showInfo || indexOpen || settingsOpen || studyVerse) {
      if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
      setControlsVisible(true);
      return;
    }
    revealControls();
  // إعادة إظهار الأدوات عقب تغيير الصفحة أو إغلاق اللوحات ثم إخفاؤها بهدوء.
   
  }, [focusMode, pageNumber, showInfo, indexOpen, settingsOpen, studyVerse]);

  const setActivePage = (next: number) => {
    const target = clampMushafPage(next);
    if (target === pageNumber) return;
    setTapState(null);
    setSelectedVerse(null);
    setVerseActionsOpen(false);
    setStudyVerse(null);
    setTapHint("");
    setLoadedPage(null);
    setShowStartHighlight(false);
    setSwipeOffset(0);
    setIsSwiping(false);
    setPageZoom(1);
    setPagePan({ x: 0, y: 0 });
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
      onVerseSelect?.({ page: pageNumber, surah, ayah });
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

  const registerCanvasTap = (event: React.PointerEvent<HTMLDivElement>) => {
    if (selectionContext || (event.target instanceof Element && event.target.closest("[data-ayah-zone]"))) return;
    const now = Date.now();
    if (now - lastCanvasTap.current <= DOUBLE_TAP_DELAY_MS) {
      setPageZoom((current) => current > 1 ? 1 : 1.7);
      setPagePan({ x: 0, y: 0 });
      lastCanvasTap.current = 0;
    } else lastCanvasTap.current = now;
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
    revealControls();
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!selectionContext && touchPoints.current.size >= 2) {
      clearLongPress();
      pointerStart.current = null;
      panStart.current = null;
      pinchStart.current = { distance: distanceBetween(Array.from(touchPoints.current.values()).slice(0, 2)), zoom: pageZoom };
      setIsSwiping(false);
      return;
    }
    if (!selectionContext && pageZoom > 1) {
      panStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: pagePan };
      pointerStart.current = null;
      return;
    }
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
    if (touchPoints.current.has(event.pointerId)) touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchStart.current && touchPoints.current.size >= 2) {
      const nextDistance = distanceBetween(Array.from(touchPoints.current.values()).slice(0, 2));
      if (nextDistance > 0 && pinchStart.current.distance > 0) {
        const nextZoom = clampPageZoom(pinchStart.current.zoom * (nextDistance / pinchStart.current.distance));
        setPageZoom(nextZoom);
        if (nextZoom === 1) setPagePan({ x: 0, y: 0 });
      }
      return;
    }
    const activePan = panStart.current;
    if (activePan?.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - activePan.x, event.clientY - activePan.y);
      if (moved > 8) suppressVerseClick.current = true;
      const maxPan = Math.round(170 * Math.max(0, pageZoom - 1));
      setPagePan({ x: Math.max(-maxPan, Math.min(maxPan, activePan.pan.x + event.clientX - activePan.x)), y: Math.max(-maxPan, Math.min(maxPan, activePan.pan.y + event.clientY - activePan.y)) });
      return;
    }
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) return;
    setIsSwiping(true);
    setSwipeOffset(Math.max(-82, Math.min(82, deltaX * 0.42)));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    touchPoints.current.delete(event.pointerId);
    if (pinchStart.current) {
      if (touchPoints.current.size < 2) pinchStart.current = null;
      panStart.current = null;
      pointerStart.current = null;
      return;
    }
    if (panStart.current?.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - panStart.current.x, event.clientY - panStart.current.y);
      panStart.current = null;
      if (moved <= 8) registerCanvasTap(event);
      return;
    }
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const direction = resolveMushafSwipeDirection(deltaX, deltaY);
    if (!direction) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) registerCanvasTap(event);
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

  const handlePointerCancel = () => { pointerStart.current = null; panStart.current = null; pinchStart.current = null; touchPoints.current.clear(); setSwipeOffset(0); setIsSwiping(false); };
  const resetPageZoom = () => { setPageZoom(1); setPagePan({ x: 0, y: 0 }); setHint("عاد عرض الصفحة إلى الحجم الكامل."); };
  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await focusRoot.current?.requestFullscreen();
    } catch {
      setHint("لا يدعم المتصفح وضع ملء الشاشة في هذه اللحظة.");
    }
  };
  const shareCurrentPage = async () => {
    const url = `${window.location.origin}/quran/read?page=${pageNumber}`;
    const shareData = { title: "مصحف ترتيل", text: `صفحة ${pageNumber} من مصحف ترتيل`, url };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard?.writeText(url);
      setHint("نُسخ رابط صفحة المصحف.");
    } catch {
      if (!navigator.share) setHint("تعذر نسخ الرابط في هذا المتصفح.");
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
  const openVerseActions = () => {
    if (!selectedVerse) return;
    revealControls();
    setVerseActionsOpen(true);
  };
  const getSelectedVerseShareText = () => selectedVerse && selectedVerseText ? `﴿${selectedVerseText}﴾\n[${selectedVerse.surah}:${selectedVerse.ayah}]` : null;
  const copySelectedVerse = async () => {
    const text = getSelectedVerseShareText();
    if (!text) { setHint("انتظر حتى يكتمل تحميل نص الآية."); return; }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const fallback = document.createElement("textarea");
        fallback.value = text;
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand("copy");
        fallback.remove();
      }
      setHint("نُسخ نص الآية ومرجعها.");
    } catch { setHint("تعذر نسخ نص الآية في هذا المتصفح."); }
  };
  const shareSelectedVerse = async () => {
    const text = getSelectedVerseShareText();
    if (!text || !selectedVerse) { setHint("انتظر حتى يكتمل تحميل نص الآية."); return; }
    const shareData = { title: "مصحف ترتيل", text, url: `${window.location.origin}/quran/read?page=${pageNumber}` };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) await navigator.share(shareData);
      else await copySelectedVerse();
    } catch { setHint("تعذرت مشاركة الآية في هذا المتصفح."); }
  };
  const saveSelectedVersePreference = async (isFavorite: boolean, note: string | null) => {
    if (!selectedVerse) return;
    if (!isAuthenticated) { setHint("سجّل الدخول لحفظ المفضلة والملاحظات في حسابك."); return; }
    try {
      await saveVersePreference.mutateAsync({ pageNumber, surahNumber: selectedVerse.surah, ayahNumber: selectedVerse.ayah, isFavorite, note });
      setHint(isFavorite ? "حُفظت الآية ضمن المفضلة." : note ? "حُفظت ملاحظتك على الآية." : "أزيلت تفضيلات هذه الآية.");
    } catch { setHint("تعذر حفظ تفضيلات الآية. حاول مجدداً."); }
  };
  const toggleVerseFavorite = () => void saveSelectedVersePreference(!selectedVersePreference?.isFavorite, selectedVersePreference?.note ?? null);
  const saveVerseNote = () => void saveSelectedVersePreference(selectedVersePreference?.isFavorite ?? false, noteDraft.trim() || null);

  if (error) {
    return <div className="flex min-h-[100svh] items-center justify-center bg-background p-5" dir="rtl"><div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-6 text-center"><p className="font-display text-lg font-bold text-foreground">تعذر فتح صفحات المصحف</p><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" type="button" onClick={() => window.location.reload()}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button></div></div>;
  }

  if (!manifest || !page) {
    return <div className={focusMode ? "flex min-h-[100svh] flex-col items-center justify-center gap-3 bg-background text-muted-foreground" : "flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-3xl border border-primary/10 bg-card/60 text-muted-foreground"} dir="rtl"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="text-sm">جارٍ فتح صفحة المصحف…</p></div>;
  }

  const pageCanvas = <div className={`mushaf-page-shell relative select-none overflow-hidden rounded-[1.7rem] border border-amber-950/15 bg-[#f8f2e2] p-1 shadow-[0_18px_55px_-25px_rgba(57,42,15,0.55)] mushaf-page-scale-${readerPreferences.pageScale} ${focusMode ? "mushaf-focus-page" : "mx-auto w-full max-w-[760px]"} ${isSwiping ? "mushaf-page-is-swiping" : ""} ${pageZoom > 1 ? "mushaf-page-zoomed" : ""}`} style={{ transform: `translate3d(${pagePan.x + swipeOffset}px, ${pagePan.y}px, 0) scale(${pageZoom})` }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}>
    <div translate="no" lang="ar" className={`mushaf-page-artwork relative aspect-[382.68/547.09] w-full ${pageMotion ? pageMotion === "next" ? "mushaf-page-enter-next" : "mushaf-page-enter-previous" : ""}`}>
      <img key={page.page} src={page.url} alt={`صفحة ${page.page} من مصحف المدينة`} draggable={false} decoding="async" onLoad={() => setLoadedPage(page.page)} className="absolute inset-0 h-full w-full" />
      {showStartHighlight && startZones.map(([, , , left, top, width, height], index) => <span key={`start-${highlightKey}-${index}`} aria-hidden="true" className="mushaf-start-highlight pointer-events-none absolute rounded-[0.2rem]" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${(width / 382.68) * 100}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
      {(pageData?.zones ?? []).map(([surah, ayah, line, left, top, width, height], index) => <button data-ayah-zone key={`${surah}-${ayah}-${line}-${index}`} type="button" aria-label={`الآية ${ayah} من السورة ${surah}`} onPointerDown={(event) => handleVersePointerDown(event, surah, ayah)} onPointerMove={handleVersePointerMove} onPointerUp={clearLongPress} onPointerCancel={clearLongPress} onClick={() => selectVerse(surah, ayah)} className="absolute cursor-pointer rounded-[0.2rem] bg-transparent outline-none focus-visible:bg-primary/25 focus-visible:ring-2 focus-visible:ring-primary/70" style={{ left: `${(left / 382.68) * 100}%`, top: `${(top / 547.09) * 100}%`, width: `${Math.max((width / 382.68) * 100, 0.5)}%`, height: `${Math.max((height / 547.09) * 100, 1.2)}%` }} />)}
    </div>
    <div aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-[1.3rem] border border-amber-700/20"><span className="mushaf-frame-corner mushaf-frame-corner-tr" /><span className="mushaf-frame-corner mushaf-frame-corner-tl" /><span className="mushaf-frame-corner mushaf-frame-corner-br" /><span className="mushaf-frame-corner mushaf-frame-corner-bl" /></div>
  </div>;

  if (focusMode) {
    return <section ref={focusRoot} onPointerDownCapture={revealControls} onFocusCapture={revealControls} className={`mushaf-reader-shell relative h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(225,198,118,0.2),_transparent_38%),linear-gradient(135deg,#f7f3e9,#e8efe7)] ${readerPreferences.darkMode ? "mushaf-dark" : ""}`} dir="rtl">
      <div className={`mushaf-reader-controls mushaf-reader-topbar absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4 ${controlsVisible ? "mushaf-controls-visible" : "mushaf-controls-hidden"}`}>
        <button type="button" onClick={onClose} aria-label="العودة من المصحف" className="mushaf-reader-close flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm backdrop-blur"><ArrowRight className="h-5 w-5" /></button>
        <div className="mushaf-page-counter rounded-full border border-amber-900/10 bg-white/90 px-3 py-1.5 text-center text-primary shadow-sm backdrop-blur"><p className="max-w-40 truncate text-[11px] font-bold">سورة {pageSurahNames}</p><p className="mt-0.5 text-[10px] font-semibold text-primary/75">{currentJuz ? `الجزء ${currentJuz} · ` : ""}{page.page}/604</p></div>
        <span aria-hidden="true" className="h-10 w-10" />
      </div>

      <div className={`mushaf-reader-controls ${controlsVisible ? "mushaf-controls-visible" : "mushaf-controls-hidden"}`}>
        <button type="button" onClick={() => setShowInfo((current) => !current)} aria-expanded={showInfo} aria-controls="mushaf-info-panel" aria-label={showInfo ? "إخفاء بيانات المصحف" : "إظهار بيانات المصحف"} className={`mushaf-reader-fab mushaf-info-fab absolute left-4 top-16 z-30 flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-bold backdrop-blur ${showInfo ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_28px_-12px_rgba(9,79,58,0.75)]" : "border-amber-900/15 bg-white/95 text-primary shadow-[0_12px_28px_-14px_rgba(57,42,15,0.6)]"}`}><Info className="h-5 w-5" /><span>البيانات</span></button>
        <div id="mushaf-info-panel" aria-hidden={!showInfo} className={`mushaf-info-panel absolute left-4 top-32 z-20 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-primary/15 bg-white/95 p-4 text-right text-xs leading-6 text-muted-foreground shadow-xl backdrop-blur ${showInfo ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-3 scale-[0.97] opacity-0"}`}>{selectionContext ? `ابدأ من الآية ${startAyah}، ثم انقر ثلاث مرات متتالية على آية النهاية للعودة إلى نموذج ${selectionContext.kind === "memorization" ? "الحفظ" : "المراجعة"}.` : "مصحف المدينة المرئي بصفحات كاملة. اسحب أفقياً للتقليب بين الصفحات."}</div>
        <button type="button" onClick={() => setIndexOpen(true)} aria-label="فتح فهرس المصحف" className="mushaf-reader-fab mushaf-index-fab absolute right-4 top-16 z-30 flex h-12 items-center gap-2 rounded-full border border-amber-900/15 bg-white/95 px-4 text-sm font-bold text-primary shadow-[0_12px_28px_-14px_rgba(57,42,15,0.6)] backdrop-blur"><ListTree className="h-5 w-5" /><span>الفهرس</span></button>
        <button type="button" onClick={() => void toggleBrowserFullscreen()} aria-label={browserFullscreen ? "إنهاء وضع ملء الشاشة" : "تفعيل وضع ملء الشاشة"} className="mushaf-reader-fab mushaf-reader-utility-fab absolute right-5 top-32 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/95 text-primary shadow-sm backdrop-blur"><span className="sr-only">{browserFullscreen ? "إنهاء وضع ملء الشاشة" : "تفعيل وضع ملء الشاشة"}</span>{browserFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
        <button type="button" onClick={() => void shareCurrentPage()} aria-label="مشاركة صفحة المصحف الحالية" className="mushaf-reader-fab mushaf-reader-utility-fab absolute right-5 top-44 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/95 text-primary shadow-sm backdrop-blur"><Share2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => setSettingsOpen(true)} aria-label="إعدادات القراءة" className="mushaf-reader-fab mushaf-settings-fab mushaf-reader-utility-fab absolute right-5 top-56 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-amber-900/15 bg-white/95 text-primary shadow-sm backdrop-blur"><Settings2 className="h-4 w-4" /></button>
        {selectionContext && <p className="mushaf-selection-prompt absolute inset-x-0 top-[7.35rem] z-20 mx-auto w-fit rounded-full border border-amber-700/15 bg-white/82 px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm backdrop-blur">اختيار آية النهاية · ثلاث نقرات للتأكيد</p>}
      </div>
      <div className="mushaf-reader-canvas absolute inset-0 grid place-items-center p-0">{pageCanvas}</div>
      {!selectionContext && selectedVerse && <button type="button" onClick={openVerseActions} className={`mushaf-reader-controls absolute bottom-5 right-5 z-20 flex min-h-11 items-center gap-2 rounded-full border border-amber-900/15 bg-white/95 px-4 py-2.5 text-sm font-bold text-primary shadow-lg backdrop-blur ${controlsVisible ? "mushaf-controls-visible" : "mushaf-controls-hidden"}`}><MessageSquareText className="h-4 w-4" />الآية {selectedVerse.ayah}</button>}
      {!selectionContext && pageZoom > 1 && <button type="button" onClick={resetPageZoom} className={`mushaf-reader-controls absolute bottom-5 right-1/2 z-20 flex translate-x-1/2 items-center gap-2 rounded-full border border-amber-900/15 bg-white/95 px-4 py-2.5 text-sm font-bold text-primary shadow-lg backdrop-blur ${controlsVisible ? "mushaf-controls-visible" : "mushaf-controls-hidden"}`}><RotateCcw className="h-4 w-4" />إعادة العرض</button>}
      <button type="button" onClick={() => void togglePageBookmark()} aria-label={hasBookmark(`page:${pageNumber}`) ? "إزالة علامة الصفحة المرجعية" : "حفظ علامة الصفحة المرجعية"} className={`mushaf-reader-controls absolute bottom-5 left-5 z-20 flex h-11 items-center justify-center rounded-full border shadow-lg backdrop-blur ${hasBookmark(`page:${pageNumber}`) ? "border-primary bg-primary text-primary-foreground" : "border-amber-900/15 bg-white/95 text-primary"} ${controlsVisible ? "mushaf-controls-visible" : "mushaf-controls-hidden"}`}>{hasBookmark(`page:${pageNumber}`) ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}</button>
      {tapHint && <p role="status" aria-live="polite" className="absolute inset-x-4 bottom-5 z-20 mx-auto w-fit rounded-full bg-emerald-950/90 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">{tapHint}</p>}
      <button type="button" aria-label="الصفحة السابقة" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)} className={`mushaf-reader-controls mushaf-page-nav absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm disabled:opacity-35 ${controlsVisible ? "mushaf-controls-visible" : "mushaf-controls-hidden"}`}><ChevronRight className="h-5 w-5" /></button>
      <button type="button" aria-label="الصفحة التالية" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)} className={`mushaf-reader-controls mushaf-page-nav absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-900/15 bg-white/90 text-foreground shadow-sm disabled:opacity-35 ${controlsVisible ? "mushaf-controls-visible" : "mushaf-controls-hidden"}`}><ChevronLeft className="h-5 w-5" /></button>
      <MushafIndexSheet open={indexOpen} onOpenChange={setIndexOpen} manifest={manifest} currentPage={page.page} onPageSelect={setActivePage} bookmarks={bookmarks} versePreferences={versePreferences} onBookmarkRemove={(bookmark) => void removeBookmark.mutateAsync(bookmark.referenceType === "page" ? { referenceType: "page", pageNumber: bookmark.pageNumber } : { referenceType: "ayah", pageNumber: bookmark.pageNumber, surahNumber: bookmark.surahNumber ?? undefined, ayahNumber: bookmark.ayahNumber ?? undefined })} />
      <Sheet open={verseActionsOpen} onOpenChange={setVerseActionsOpen}>
        <SheetContent side="bottom" dir="rtl" className="max-h-[84svh] rounded-t-[2rem] p-0">
          <SheetHeader className="border-b border-border/60 bg-primary/5 px-5 pb-4 pt-6 text-right"><SheetTitle className="font-display text-xl text-foreground">أدوات الآية</SheetTitle><SheetDescription>السورة {selectedVerse?.surah} · الآية {selectedVerse?.ayah} · تُحفظ المفضلة والملاحظات في حسابك.</SheetDescription></SheetHeader>
          <div className="max-h-[calc(84svh-7rem)] space-y-4 overflow-y-auto p-5">
            {verseTextError ? <p className="rounded-2xl bg-destructive/10 p-4 text-sm leading-7 text-destructive">{verseTextError}</p> : !selectedVerseText ? <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />جارٍ تحميل النص العثماني المرجعي…</div> : <blockquote className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-right font-serif text-lg leading-9 text-foreground">﴿{selectedVerseText}﴾</blockquote>}
            <div className="grid grid-cols-2 gap-2"><button type="button" disabled={!selectedVerseText} onClick={() => void copySelectedVerse()} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-card px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"><Copy className="h-4 w-4" />نسخ الآية</button><button type="button" disabled={!selectedVerseText} onClick={() => void shareSelectedVerse()} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-card px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"><Share2 className="h-4 w-4" />مشاركة</button><button type="button" onClick={() => void toggleVerseBookmark()} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-card px-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"><Bookmark className="h-4 w-4" />{selectedVerse && hasBookmark(`ayah:${selectedVerse.surah}:${selectedVerse.ayah}`) ? "إزالة العلامة" : "حفظ علامة"}</button><button type="button" onClick={toggleVerseFavorite} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold transition-colors ${selectedVersePreference?.isFavorite ? "border-rose-300 bg-rose-50 text-rose-700" : "border-primary/15 bg-card text-primary hover:bg-primary/5"}`}><Heart className={`h-4 w-4 ${selectedVersePreference?.isFavorite ? "fill-current" : ""}`} />{selectedVersePreference?.isFavorite ? "ضمن المفضلة" : "إضافة للمفضلة"}</button></div>
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-3"><label htmlFor="quran-verse-note" className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"><MessageSquareText className="h-4 w-4 text-primary" />ملاحظة شخصية</label><Textarea id="quran-verse-note" value={noteDraft} maxLength={2400} onChange={(event) => setNoteDraft(event.target.value)} placeholder="مثل: أحتاج لمراجعة هذه الآية." className="min-h-24 resize-y bg-background" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{noteDraft.length}/2400</span><button type="button" onClick={saveVerseNote} className="flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97]"><Check className="h-4 w-4" />حفظ الملاحظة</button></div></div>
          </div>
        </SheetContent>
      </Sheet>
      <QuranStudySheet open={Boolean(studyVerse)} onOpenChange={(open) => !open && setStudyVerse(null)} pageNumber={studyVerse?.page ?? page.page} surahNumber={studyVerse?.surah ?? null} ayahNumber={studyVerse?.ayah ?? null} textScale={readerPreferences.textScale} studyFont={readerPreferences.studyFont} darkMode={readerPreferences.darkMode} />
      <QuranReaderSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} preferences={readerPreferences} onChange={setReaderPreferences} screenWakeLockSupported={screenWakeLockSupported} />
    </section>;
  }

  return <section className="space-y-4" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-display font-bold text-foreground">مصحف المدينة المرئي</p><p className="mt-1 text-sm text-muted-foreground">صفحة {page.page} من 604 · اسحب أفقياً للتقليب</p></div></div><div className="flex items-center justify-between gap-2 rounded-xl bg-background/80 p-1.5 shadow-sm"><Button type="button" size="sm" variant="ghost" disabled={page.page <= 1} onClick={() => setActivePage(page.page - 1)}><ChevronRight className="ml-1 h-4 w-4" />السابقة</Button><span className="min-w-16 text-center text-xs font-bold text-primary">{page.page}/604</span><Button type="button" size="sm" variant="ghost" disabled={page.page >= 604} onClick={() => setActivePage(page.page + 1)}>التالية<ChevronLeft className="mr-1 h-4 w-4" /></Button></div></div>
    {tapHint && <p role="status" aria-live="polite" className="rounded-xl bg-muted/70 px-4 py-3 text-center text-sm text-muted-foreground">{tapHint}</p>}
    {pageCanvas}
  </section>;
}
