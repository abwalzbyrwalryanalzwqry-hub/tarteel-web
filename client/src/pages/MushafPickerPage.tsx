import { VisualMushafReader } from "@/components/VisualMushafReader";
import { readMushafSelectionContext } from "@/lib/mushafSelection";
import { QURAN_SURAHS } from "../../../shared/types";
import { useLocation } from "wouter";
import { useMemo } from "react";

function getPickerParams() {
  const params = new URLSearchParams(window.location.search);
  const surah = Number(params.get("surah"));
  const ayah = Number(params.get("ayah"));
  return {
    surah: QURAN_SURAHS.some((item) => item.number === surah) ? surah : 1,
    ayah: ayah > 0 ? ayah : 1,
    token: params.get("mushafToken"),
  };
}

export default function MushafPickerPage() {
  const [, navigate] = useLocation();
  const initial = useMemo(getPickerParams, []);
  const selectionContext = useMemo(() => readMushafSelectionContext(initial.token), [initial.token]);

  return <VisualMushafReader startSurah={initial.surah} startAyah={initial.ayah} selectionContext={selectionContext} focusMode onClose={() => navigate(selectionContext?.returnPath ?? "/quran")} />;
}
