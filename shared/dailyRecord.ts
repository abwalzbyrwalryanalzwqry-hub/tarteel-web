/**
 * السجل اليومي للحلقة: قواعد المجال المشتركة بين الخادم ونسخة الجهاز (منقولة من زِن، docs/DAILY_RECORD.md).
 *
 * - الحفظ والمراجعة لكل طالب في اليوم مدى واحد قد يمتد عبر سور، في أحد اتجاهين: بترتيب المصحف
 *   (forward) أو من الناس صعوداً (backward). يُخزَّن بأرقام السور، ويُعرض مقاطع سورة سورة بأسماء زِن.
 * - الدرجة 1..5 تُعرض للواجهة درجةً من 100 كما في زِن (grade_to_score)، وتُعاد 1..5 بـ scoreToGrade.
 */
import { QURAN_SURAHS } from "./types";

export const DAILY_ATTENDANCE = [
  "present",
  "late",
  "absent",
  "excused",
] as const;
export type DailyAttendance = (typeof DAILY_ATTENDANCE)[number];
export const DAILY_ERROR_TYPES = [
  "none",
  "hifz",
  "tajweed",
  "tashkeel",
  "waqf",
] as const;
export type DailyErrorType = (typeof DAILY_ERROR_TYPES)[number];
export const DAILY_EVAL_CRITERIA = [
  "overall",
  "tajweed",
  "pronunciation",
  "behavior",
] as const;
export type DailyEvalCriterion = (typeof DAILY_EVAL_CRITERIA)[number];
export type DailyRecordStatus = "open" | "completed" | "locked";
export type DailyKind = "memorize" | "review";
export type DailyDirection = "forward" | "backward";

/** أقصى عدد سور في مدى واحد (كما في زِن): يكفي جزء عمّ كاملاً. */
export const DAILY_MAX_SEGMENTS = 60;
/** مدة بقاء اليوم المحذوف في سلّة السجل. */
export const DAILY_TRASH_DAYS = 30;

/** أسماء السور بإملاء زِن (سبإ، النبإ) لأن شاشات السجل المنقولة تطابق بها. */
export const DAILY_SURAHS = QURAN_SURAHS.map(s => ({
  number: s.number,
  name: s.number === 34 ? "سبإ" : s.number === 78 ? "النبإ" : s.name,
  ayahs: s.ayahs,
}));

const byName = new Map<string, number>();
for (const s of QURAN_SURAHS) byName.set(s.name, s.number);
for (const s of DAILY_SURAHS) byName.set(s.name, s.number);

export const surahNumberOf = (name: string): number | null =>
  byName.get(name.trim()) ?? null;
export const surahOf = (n: number) => DAILY_SURAHS[n - 1];

export interface DailySegment {
  surah_name: string;
  from_ayah: number;
  to_ayah: number;
}
export interface DailyRange {
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number;
}

export function isValidRange(r: DailyRange): boolean {
  const a = surahOf(r.fromSurah);
  const b = surahOf(r.toSurah);
  if (!a || !b) return false;
  if (
    r.fromAyah < 1 ||
    r.fromAyah > a.ayahs ||
    r.toAyah < 1 ||
    r.toAyah > b.ayahs
  )
    return false;
  if (r.fromSurah === r.toSurah && r.toAyah < r.fromAyah) return false;
  return Math.abs(r.toSurah - r.fromSurah) + 1 <= DAILY_MAX_SEGMENTS;
}

/** المدى إلى مقاطع سورة سورة بترتيبه: الأولى من آية البداية، والوسطى كاملة، والأخيرة إلى آية النهاية. */
export function rangeSegments(r: DailyRange): DailySegment[] {
  if (!isValidRange(r)) return [];
  const step = r.toSurah >= r.fromSurah ? 1 : -1;
  const out: DailySegment[] = [];
  for (let n = r.fromSurah; n !== r.toSurah + step; n += step) {
    const s = surahOf(n);
    out.push({
      surah_name: s.name,
      from_ayah: n === r.fromSurah ? r.fromAyah : 1,
      to_ayah: n === r.toSurah ? r.toAyah : s.ayahs,
    });
  }
  return out;
}

/**
 * مقاطع الواجهة إلى مدى واحد، مع التحقق أنها متصلة كما يبنيها rangeToSegments في الواجهة. null = غير صالحة.
 * مقطع واحد داخل سورة قد يبدأ وينتهي في أي آية؛ والمقاطع المتعددة متتالية السور في اتجاه واحد.
 */
export function segmentsToRange(segments: DailySegment[]): DailyRange | null {
  if (!segments.length || segments.length > DAILY_MAX_SEGMENTS) return null;
  const nums = segments.map(s => surahNumberOf(s.surah_name));
  if (nums.some(n => n == null)) return null;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const range: DailyRange = {
    fromSurah: nums[0]!,
    fromAyah: first.from_ayah,
    toSurah: nums[nums.length - 1]!,
    toAyah: last.to_ayah,
  };
  for (const s of segments)
    if (
      !Number.isInteger(s.from_ayah) ||
      !Number.isInteger(s.to_ayah) ||
      s.to_ayah < s.from_ayah
    )
      return null;
  const expected = rangeSegments(range);
  if (expected.length !== segments.length) return null;
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const s = segments[i];
    if (
      nums[i] !== surahNumberOf(e.surah_name) ||
      e.from_ayah !== s.from_ayah ||
      e.to_ayah !== s.to_ayah
    )
      return null;
  }
  return range;
}

const SCORES = [0, 35, 55, 70, 85, 95] as const;
export const gradeToScore = (
  grade: number | null | undefined
): number | null =>
  grade != null && grade >= 1 && grade <= 5 ? SCORES[grade] : null;
export const scoreToGrade5 = (
  score: number | null | undefined
): number | null =>
  score == null
    ? null
    : score >= 95
      ? 5
      : score >= 85
        ? 4
        : score >= 70
          ? 3
          : score >= 55
            ? 2
            : 1;

/** «yyyy-mm-dd» صالح. */
export const isDayKey = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (day: string) =>
  new Date(`${day}T00:00:00Z`).getUTCDay();

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000
  );

/** رموز أخطاء السجل اليومي (تطابق ما تفهمه شاشات زِن من رسالة الخطأ). */
export const DAILY_ERROR_CODES = [
  "AUTH_REQUIRED",
  "NOT_YOUR_HALAQA",
  "INVALID_DATE",
  "INVALID_STATUS",
  "INVALID_REASON",
  "INVALID_PAYLOAD",
  "INVALID_RANGE",
  "INVALID_GRADE",
  "INVALID_ERROR_TYPE",
  "INVALID_NOTES",
  "INVALID_DIRECTION",
  "INVALID_EVALUATION",
  "INVALID_TRANSITION",
  "INVALID_ROWS",
  "RECORD_NOT_FOUND",
  "RECORD_LOCKED",
  "RECORD_COMPLETED",
  "STUDENT_NOT_IN_HALAQA",
  "STUDENT_NOT_PRESENT",
  "HAS_ACHIEVEMENT",
  "NO_ATTENDANCE",
  "VERSION_CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "RECORD_EXISTS",
] as const;
export type DailyErrorCode = (typeof DAILY_ERROR_CODES)[number];
