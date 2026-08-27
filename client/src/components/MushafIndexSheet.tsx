import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { loadQuranNavigation } from "@/lib/quranNavigation";
import { loadQuranVerses, searchQuranVerses, type QuranVerse } from "../../../shared/quran";
import { Bookmark, BookOpenText, ChevronLeft, Grid2X2, Heart, Layers3, Loader2, MessageSquareText, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QURAN_SURAHS } from "../../../shared/types";
import type { MushafVisualManifest } from "../../../shared/mushafVisual";
import type { QuranNavigationData } from "../../../shared/quranNavigation";

type IndexTab = "surahs" | "juz" | "hizbs" | "pages" | "bookmarks" | "favorites";

export interface MushafBookmarkItem {
  id: number;
  referenceType: "page" | "ayah";
  referenceKey: string;
  pageNumber: number;
  surahNumber: number | null;
  ayahNumber: number | null;
  label: string | null;
}

export interface MushafVersePreferenceItem {
  id: number;
  verseKey: string;
  pageNumber: number;
  surahNumber: number;
  ayahNumber: number;
  isFavorite: boolean;
  note: string | null;
}

interface MushafIndexSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: MushafVisualManifest;
  currentPage: number;
  onPageSelect: (page: number) => void;
  bookmarks?: MushafBookmarkItem[];
  onBookmarkRemove?: (bookmark: MushafBookmarkItem) => void;
  versePreferences?: MushafVersePreferenceItem[];
}

const INDEX_TABS: Array<{ id: IndexTab; label: string; icon: typeof BookOpenText }> = [
  { id: "surahs", label: "السور", icon: BookOpenText },
  { id: "juz", label: "الأجزاء", icon: Layers3 },
  { id: "hizbs", label: "الأحزاب", icon: Grid2X2 },
  { id: "pages", label: "الصفحات", icon: Search },
  { id: "bookmarks", label: "علاماتي", icon: Bookmark },
  { id: "favorites", label: "المفضلة", icon: Heart },
];

export function MushafIndexSheet({ open, onOpenChange, manifest, currentPage, onPageSelect, bookmarks = [], onBookmarkRemove, versePreferences = [] }: MushafIndexSheetProps) {
  const [activeTab, setActiveTab] = useState<IndexTab>("surahs");
  const [query, setQuery] = useState("");
  const [quickQuery, setQuickQuery] = useState("");
  const [verseResults, setVerseResults] = useState<QuranVerse[]>([]);
  const [searchingVerses, setSearchingVerses] = useState(false);
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [navigation, setNavigation] = useState<QuranNavigationData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { setPageInput(String(currentPage)); }, [currentPage]);
  useEffect(() => {
    if (!open || navigation) return;
    let active = true;
    loadQuranNavigation().then((data) => active && setNavigation(data)).catch((error) => active && setLoadError(error instanceof Error ? error.message : "تعذر تحميل فهرس الأجزاء والأحزاب."));
    return () => { active = false; };
  }, [navigation, open]);

  useEffect(() => {
    const normalized = quickQuery.trim();
    if (normalized.length < 2 || /^\d+$/.test(normalized)) { setVerseResults([]); setSearchingVerses(false); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchingVerses(true);
      loadQuranVerses().then((verses) => active && setVerseResults(searchQuranVerses(verses, normalized, 12))).catch(() => active && setVerseResults([])).finally(() => active && setSearchingVerses(false));
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [quickQuery]);

  const surahPages = useMemo(() => new Map(QURAN_SURAHS.map((surah) => [surah.number, manifest.pages.find((page) => page.verses.some(([number]) => number === surah.number))?.page ?? 1])), [manifest]);
  const filteredSurahs = useMemo(() => QURAN_SURAHS.filter((surah) => `${surah.number} ${surah.name}`.includes(query.trim())), [query]);
  const quickSurahs = useMemo(() => quickQuery.trim() ? QURAN_SURAHS.filter((surah) => `${surah.number} ${surah.name}`.includes(quickQuery.trim())).slice(0, 8) : [], [quickQuery]);
  const quickPage = Number(quickQuery.trim());
  const isPageQuery = Number.isInteger(quickPage) && quickPage >= 1 && quickPage <= 604;
  const verseSearchResults = useMemo(() => verseResults.map((verse) => ({ verse, page: manifest.pages.find((page) => page.verses.some(([surah, ayah]) => surah === verse.surah && ayah === verse.ayah))?.page ?? 1 })), [manifest, verseResults]);
  const goTo = (page: number) => { onPageSelect(Math.min(604, Math.max(1, Math.round(page)))); onOpenChange(false); };
  const activeButtonClass = "bg-primary text-primary-foreground shadow-sm";

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" dir="rtl" className="w-[92vw] gap-0 overflow-hidden border-l-primary/10 p-0 sm:max-w-md">
      <SheetHeader className="border-b border-border/60 bg-primary/5 px-5 pb-4 pt-6 text-right"><SheetTitle className="font-display text-2xl text-foreground">فهرس المصحف</SheetTitle><SheetDescription className="leading-6">انتقل مباشرة بين السور والأجزاء والأحزاب والصفحات.</SheetDescription><div className="relative mt-2"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} className="bg-background pr-10" placeholder="ابحث باسم سورة أو صفحة أو كلمة قرآنية" /></div></SheetHeader>
      {quickQuery.trim() && <div className="max-h-56 overflow-y-auto border-b border-border/60 bg-background p-3"><p className="mb-2 text-xs font-bold text-primary">نتائج البحث السريع</p><div className="space-y-1.5">{isPageQuery && <button type="button" onClick={() => goTo(quickPage)} className="flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-2.5 text-right"><Search className="h-4 w-4 text-primary" /><span className="flex-1 text-sm font-semibold text-foreground">الانتقال إلى الصفحة {quickPage}</span><ChevronLeft className="h-4 w-4 text-primary" /></button>}{quickSurahs.map((surah) => <button key={surah.number} type="button" onClick={() => goTo(surahPages.get(surah.number) ?? 1)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-right hover:bg-primary/5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{surah.number}</span><span className="flex-1 text-sm font-semibold text-foreground">{surah.name}</span><span className="text-xs text-muted-foreground">ص {surahPages.get(surah.number)}</span></button>)}{searchingVerses && <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />جارٍ البحث في النص العثماني…</div>}{verseSearchResults.map(({ verse, page }) => <button key={`${verse.surah}-${verse.ayah}`} type="button" onClick={() => goTo(page)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-right hover:bg-primary/5"><span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-primary/10 px-1 text-xs font-bold text-primary">{verse.ayah}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{verse.text}</span><span className="shrink-0 text-xs text-muted-foreground">س {verse.surah} · ص {page}</span></button>)}{!isPageQuery && quickSurahs.length === 0 && !searchingVerses && verseResults.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">لا توجد نتائج مطابقة.</p>}</div></div>}
      <div className="grid grid-cols-6 gap-1 border-b border-border/60 bg-background p-2">{INDEX_TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setActiveTab(id); setQuery(""); }} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors ${activeTab === id ? activeButtonClass : "text-muted-foreground hover:bg-muted"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "surahs" && <><div className="relative mb-3"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pr-10" placeholder="ابحث باسم السورة أو رقمها" /></div><div className="space-y-1.5">{filteredSurahs.map((surah) => <button key={surah.number} type="button" onClick={() => goTo(surahPages.get(surah.number) ?? 1)} className="flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-right transition-colors hover:border-primary/15 hover:bg-primary/5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{surah.number}</span><span className="flex-1 font-display font-bold text-foreground">{surah.name}</span><span className="text-xs text-muted-foreground">ص {surahPages.get(surah.number)}</span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>)}</div></>}
        {(activeTab === "juz" || activeTab === "hizbs") && <>{loadError ? <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p> : !navigation ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : <div className="space-y-2">{(activeTab === "juz" ? navigation.juz : navigation.hizbs).map((item) => <button key={item.number} type="button" onClick={() => goTo(item.page)} className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-right transition-colors hover:border-primary/20 hover:bg-primary/5"><span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{item.number}</span><span className="flex-1 font-semibold text-foreground">{activeTab === "juz" ? `الجزء ${item.number}` : `الحزب ${item.number}`}</span><span className="text-xs text-muted-foreground">ص {item.page}</span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>)}</div>}</>}
        {activeTab === "pages" && <div className="space-y-5"><div className="rounded-2xl bg-primary/5 p-4"><p className="font-display font-bold text-foreground">اذهب إلى صفحة</p><p className="mt-1 text-sm leading-6 text-muted-foreground">أدخل رقماً من 1 إلى 604 للانتقال المباشر.</p><div className="mt-4 flex gap-2"><Input inputMode="numeric" type="number" min={1} max={604} value={pageInput} onChange={(event) => setPageInput(event.target.value)} /><Button type="button" onClick={() => goTo(Number(pageInput))}>فتح الصفحة</Button></div></div><div className="grid grid-cols-3 gap-2"><Button type="button" variant="outline" onClick={() => goTo(1)}>الفاتحة</Button><Button type="button" variant="outline" onClick={() => goTo(currentPage)}>الحالية</Button><Button type="button" variant="outline" onClick={() => goTo(604)}>النهاية</Button></div><div className="grid grid-cols-5 gap-2">{Array.from({ length: 30 }, (_, index) => (index + 1) * 20).map((page) => <button key={page} type="button" onClick={() => goTo(page)} className="rounded-lg border border-border/60 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">{page}</button>)}</div></div>}
        {activeTab === "favorites" && <div className="space-y-2">{versePreferences.length === 0 ? <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-6 text-center"><Heart className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 font-display font-bold text-foreground">لا توجد آيات مفضلة أو ملاحظات</p><p className="mt-1 text-sm leading-6 text-muted-foreground">اختر آية من الصفحة ثم استخدم «أدوات الآية» لحفظها أو كتابة ملاحظة.</p></div> : versePreferences.map((preference) => <button key={preference.id} type="button" onClick={() => goTo(preference.pageNumber)} className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-3 text-right transition-colors hover:border-primary/20 hover:bg-primary/5"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${preference.isFavorite ? "bg-rose-50 text-rose-700" : "bg-primary/10 text-primary"}`}>{preference.isFavorite ? <Heart className="h-4 w-4 fill-current" /> : <MessageSquareText className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">السورة {preference.surahNumber} · الآية {preference.ayahNumber}</span><span className="mt-0.5 block text-xs text-muted-foreground">الصفحة {preference.pageNumber}{preference.isFavorite ? " · مفضلة" : ""}</span>{preference.note && <span className="mt-2 block line-clamp-2 text-sm leading-6 text-foreground/80">{preference.note}</span>}</span><ChevronLeft className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div>}
        {activeTab === "bookmarks" && <div className="space-y-2">{bookmarks.length === 0 ? <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-6 text-center"><Bookmark className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 font-display font-bold text-foreground">لا توجد علامات محفوظة</p><p className="mt-1 text-sm leading-6 text-muted-foreground">استخدم زر العلامة أسفل صفحة المصحف أو اختر آية لحفظها.</p></div> : bookmarks.map((bookmark) => <div key={bookmark.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2"><button type="button" onClick={() => goTo(bookmark.pageNumber)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-right hover:bg-primary/5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bookmark className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-foreground">{bookmark.referenceType === "ayah" ? `السورة ${bookmark.surahNumber} · الآية ${bookmark.ayahNumber}` : `الصفحة ${bookmark.pageNumber}`}</span><span className="block text-xs text-muted-foreground">الصفحة {bookmark.pageNumber}</span></span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button><button type="button" onClick={() => onBookmarkRemove?.(bookmark)} aria-label="إزالة العلامة المرجعية" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
      </div>
    </SheetContent>
  </Sheet>;
}
