import { VisualMushafReader } from "@/components/VisualMushafReader";
import { useLocation } from "wouter";
import { useMemo } from "react";

const LAST_PAGE_KEY = "tarteel-quran-reader-last-page";

function readInitialPage() {
  const requested = Number(new URLSearchParams(window.location.search).get("page"));
  if (Number.isInteger(requested) && requested >= 1 && requested <= 604) return requested;
  try {
    const saved = Number(window.localStorage.getItem(LAST_PAGE_KEY));
    if (Number.isInteger(saved) && saved >= 1 && saved <= 604) return saved;
  } catch {}
  return 1;
}

export default function QuranReaderPage() {
  const [, navigate] = useLocation();
  const initialPage = useMemo(readInitialPage, []);
  const handlePageChange = (page: number) => {
    try { window.localStorage.setItem(LAST_PAGE_KEY, String(page)); } catch {}
  };
  return <VisualMushafReader startSurah={1} startAyah={1} initialPage={initialPage} onPageChange={handlePageChange} focusMode onClose={() => navigate("/quran")} />;
}
