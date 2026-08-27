import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { loadQuranNavigation } from "@/lib/quranNavigation";
import { BookOpenText, ChevronLeft, Grid2X2, Layers3, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QURAN_SURAHS } from "../../../shared/types";
import type { MushafVisualManifest } from "../../../shared/mushafVisual";
import type { QuranNavigationData } from "../../../shared/quranNavigation";

type IndexTab = "surahs" | "juz" | "hizbs" | "pages";

interface MushafIndexSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifest: MushafVisualManifest;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

const INDEX_TABS: Array<{ id: IndexTab; label: string; icon: typeof BookOpenText }> = [
  { id: "surahs", label: "السور", icon: BookOpenText },
  { id: "juz", label: "الأجزاء", icon: Layers3 },
  { id: "hizbs", label: "الأحزاب", icon: Grid2X2 },
  { id: "pages", label: "الصفحات", icon: Search },
];

export function MushafIndexSheet({ open, onOpenChange, manifest, currentPage, onPageSelect }: MushafIndexSheetProps) {
  const [activeTab, setActiveTab] = useState<IndexTab>("surahs");
  const [query, setQuery] = useState("");
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

  const surahPages = useMemo(() => new Map(QURAN_SURAHS.map((surah) => [surah.number, manifest.pages.find((page) => page.verses.some(([number]) => number === surah.number))?.page ?? 1])), [manifest]);
  const filteredSurahs = useMemo(() => QURAN_SURAHS.filter((surah) => `${surah.number} ${surah.name}`.includes(query.trim())), [query]);
  const goTo = (page: number) => { onPageSelect(Math.min(604, Math.max(1, Math.round(page)))); onOpenChange(false); };
  const activeButtonClass = "bg-primary text-primary-foreground shadow-sm";

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" dir="rtl" className="w-[92vw] gap-0 overflow-hidden border-l-primary/10 p-0 sm:max-w-md">
      <SheetHeader className="border-b border-border/60 bg-primary/5 px-5 pb-4 pt-6 text-right"><SheetTitle className="font-display text-2xl text-foreground">فهرس المصحف</SheetTitle><SheetDescription className="leading-6">انتقل مباشرة بين السور والأجزاء والأحزاب والصفحات.</SheetDescription></SheetHeader>
      <div className="grid grid-cols-4 gap-1 border-b border-border/60 bg-background p-2">{INDEX_TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setActiveTab(id); setQuery(""); }} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${activeTab === id ? activeButtonClass : "text-muted-foreground hover:bg-muted"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === "surahs" && <><div className="relative mb-3"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pr-10" placeholder="ابحث باسم السورة أو رقمها" /></div><div className="space-y-1.5">{filteredSurahs.map((surah) => <button key={surah.number} type="button" onClick={() => goTo(surahPages.get(surah.number) ?? 1)} className="flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-right transition-colors hover:border-primary/15 hover:bg-primary/5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{surah.number}</span><span className="flex-1 font-display font-bold text-foreground">{surah.name}</span><span className="text-xs text-muted-foreground">ص {surahPages.get(surah.number)}</span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>)}</div></>}
        {(activeTab === "juz" || activeTab === "hizbs") && <>{loadError ? <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p> : !navigation ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : <div className="space-y-2">{(activeTab === "juz" ? navigation.juz : navigation.hizbs).map((item) => <button key={item.number} type="button" onClick={() => goTo(item.page)} className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-right transition-colors hover:border-primary/20 hover:bg-primary/5"><span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{item.number}</span><span className="flex-1 font-semibold text-foreground">{activeTab === "juz" ? `الجزء ${item.number}` : `الحزب ${item.number}`}</span><span className="text-xs text-muted-foreground">ص {item.page}</span><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button>)}</div>}</>}
        {activeTab === "pages" && <div className="space-y-5"><div className="rounded-2xl bg-primary/5 p-4"><p className="font-display font-bold text-foreground">اذهب إلى صفحة</p><p className="mt-1 text-sm leading-6 text-muted-foreground">أدخل رقماً من 1 إلى 604 للانتقال المباشر.</p><div className="mt-4 flex gap-2"><Input inputMode="numeric" type="number" min={1} max={604} value={pageInput} onChange={(event) => setPageInput(event.target.value)} /><Button type="button" onClick={() => goTo(Number(pageInput))}>فتح الصفحة</Button></div></div><div className="grid grid-cols-3 gap-2"><Button type="button" variant="outline" onClick={() => goTo(1)}>الفاتحة</Button><Button type="button" variant="outline" onClick={() => goTo(currentPage)}>الحالية</Button><Button type="button" variant="outline" onClick={() => goTo(604)}>النهاية</Button></div><div className="grid grid-cols-5 gap-2">{Array.from({ length: 30 }, (_, index) => (index + 1) * 20).map((page) => <button key={page} type="button" onClick={() => goTo(page)} className="rounded-lg border border-border/60 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">{page}</button>)}</div></div>}
      </div>
    </SheetContent>
  </Sheet>;
}
