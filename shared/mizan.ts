import { QURAN_SURAHS } from "./types";

export type QuranRangeInput = { surahNumber: number; toSurahNumber?: number; fromAyah: number; toAyah: number };

export function getQuranRangeError(input: QuranRangeInput): string | null {
  const endSurah = input.toSurahNumber ?? input.surahNumber;
  const from = QURAN_SURAHS.find((surah) => surah.number === input.surahNumber);
  const to = QURAN_SURAHS.find((surah) => surah.number === endSurah);
  if (!from || !to || input.fromAyah < 1 || input.toAyah < 1 || input.fromAyah > from.ayahs || input.toAyah > to.ayahs) return "رقم الآية خارج نطاق السورة المحددة";
  // تسير بعض حلقات الحفظ من أواخر المصحف إلى أوله (مثل الناس إلى الماعون)، لذلك يكون ترتيب السور مرناً.
  // أما داخل السورة الواحدة، فيلزم أن تتقدم الآية النهائية عن آية البداية أو تساويها.
  if (endSurah === input.surahNumber && input.toAyah < input.fromAyah) return "نطاق الحفظ أو المراجعة غير صحيح";
  return null;
}

export function getAttendanceSummary(rows: { status: "present" | "absent" | "late" | "excused" }[]) {
  return {
    present: rows.filter((item) => item.status === "present").length,
    absent: rows.filter((item) => item.status === "absent").length,
    excused: rows.filter((item) => item.status === "excused").length,
    late: rows.filter((item) => item.status === "late").length,
  };
}

export const MIZAN_RATING_LABELS = ["لم يختر", "يحتاج متابعة", "دون المتوقع", "جيد", "جيد جداً", "ممتاز"] as const;

export function scoreToStars(score?: number | null) {
  return Math.max(0, Math.min(5, Math.round(Number(score ?? 0) / 20)));
}
