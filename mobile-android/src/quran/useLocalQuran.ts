import { useEffect, useState } from "react";
import { loadLocalQuran, type LocalQuranVerse } from "./localQuran";

export function useLocalQuran() {
  const [verses, setVerses] = useState<LocalQuranVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    loadLocalQuran()
      .then((value) => { if (mounted) setVerses(value); })
      .catch((reason) => { console.warn("[Tarteel] local quran", reason); if (mounted) setError("تعذر فتح المصحف المحلي"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  return { verses, loading, error };
}
