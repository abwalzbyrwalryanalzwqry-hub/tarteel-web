import { VisualMushafReader } from "@/components/VisualMushafReader";
import { loadQuranReadingProgress, saveQuranReadingProgress } from "@/lib/quranReadingProgress";
import { useLocation } from "wouter";
import { useMemo } from "react";

function readInitialPage() {
  const requested = Number(new URLSearchParams(window.location.search).get("page"));
  if (Number.isInteger(requested) && requested >= 1 && requested <= 604) return requested;
  return loadQuranReadingProgress()?.page ?? 1;
}

export default function QuranReaderPage() {
  const [, navigate] = useLocation();
  const initialPage = useMemo(readInitialPage, []);
  const handlePageChange = (page: number) => saveQuranReadingProgress(page);
  const handleVerseSelect = (position: { page: number; surah: number; ayah: number }) => saveQuranReadingProgress(position.page, position);
  return <VisualMushafReader startSurah={1} startAyah={1} initialPage={initialPage} onPageChange={handlePageChange} onVerseSelect={handleVerseSelect} focusMode onClose={() => navigate("/quran")} />;
}
