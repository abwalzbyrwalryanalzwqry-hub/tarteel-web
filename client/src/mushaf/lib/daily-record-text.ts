// نصوص المدى (منقولة من src/lib/daily-record-text.ts في زِن: rangeText وحدها).
import { t as tt } from "@/mushaf/lib/i18n";
import { SURAHS } from "@/mushaf/lib/quran-meta";
import { type QuranRange } from "@/mushaf/lib/daily-record";
import { ensureRegisterDict } from "@/mushaf/lib/register-i18n";

ensureRegisterDict();

/** «الملك 1–10» أو «الملك 25 – القلم 5». */
export function rangeText(r: QuranRange | null): string {
  if (!r) return "";
  const a = SURAHS[r.fromSurah - 1]?.name ?? "";
  const b = SURAHS[r.toSurah - 1]?.name ?? "";
  return r.fromSurah === r.toSurah
    ? tt("dailyRecord.range.one", { surah: a, from: r.fromAyah, to: r.toAyah })
    : tt("dailyRecord.range.cross", {
        fromSurah: a,
        from: r.fromAyah,
        toSurah: b,
        to: r.toAyah,
      });
}
