/**
 * منطق مدى الآيات في «اختيار من المصحف» — منقول حرفياً من السجل اليومي في زِن (src/lib/daily-record.ts)،
 * الدوال التي يحتاجها منتقي المدى وقائمة السور فقط.
 */
import { SURAHS } from "@/mushaf/lib/quran-meta";
import { PAGE_STARTS } from "@/mushaf/lib/quran/structure-data";

export interface Segment {
  surah_name: string;
  from_ayah: number;
  to_ayah: number;
}

/* ─────────── مدى الآيات (المكوّن الموحَّد للحفظ والمراجعة) ─────────── */

/**
 * مدى بأرقام السور (1..114) قد يمتدّ عبر أكثر من سورة، في أحد اتجاهين:
 * - forward (بترتيب المصحف): من الفاتحة نحو الناس، fromSurah ≤ toSurah.
 * - backward (من الناس صعوداً): الناس ثم الفلق ثم الإخلاص...، fromSurah > toSurah.
 * المقطع داخل كل سورة من آية إلى ما بعدها دائماً؛ الاتجاه في ترتيب السور فقط.
 */
export interface QuranRange {
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number;
}
export type RangeDirection = "forward" | "backward";
export const RANGE_DIRECTIONS: readonly RangeDirection[] = [
  "forward",
  "backward",
];
export type RangeError =
  "incomplete" | "ayahOutOfSurah" | "endBeforeStart" | "tooLong";

/** أقصى عدد سور في مدى واحد (كما على الخادم): يكفي مراجعة جزء عمّ كاملاً (37 سورة). */
export const MAX_SEGMENTS = 60;
const surahByNo = (n: number) => SURAHS[n - 1];
export const surahNo = (name: string) =>
  SURAHS.find(s => s.name === name)?.n ?? 0;

/** اتجاه مدى مكتمل: تنازلي في أرقام السور = backward. */
export const rangeDirection = (r: Partial<QuranRange>): RangeDirection =>
  r.fromSurah && r.toSurah && r.toSurah < r.fromSurah ? "backward" : "forward";

export function validateRange(r: Partial<QuranRange>): RangeError | null {
  const { fromSurah, fromAyah, toSurah, toAyah } = r;
  if (!fromSurah || !fromAyah || !toSurah || !toAyah) return "incomplete";
  const a = surahByNo(fromSurah);
  const b = surahByNo(toSurah);
  if (!a || !b) return "incomplete";
  if (fromAyah < 1 || fromAyah > a.ayahs || toAyah < 1 || toAyah > b.ayahs)
    return "ayahOutOfSurah";
  // داخل السورة الواحدة: النهاية بعد البداية. عبر السور: أي اتجاه.
  if (toSurah === fromSurah && toAyah < fromAyah) return "endBeforeStart";
  if (Math.abs(toSurah - fromSurah) + 1 > MAX_SEGMENTS) return "tooLong";
  return null;
}

/** أرقام سور المدى بترتيبه (تصاعدياً أو تنازلياً). */
function surahsOf(r: QuranRange): number[] {
  const step = r.toSurah >= r.fromSurah ? 1 : -1;
  const out: number[] = [];
  for (let n = r.fromSurah; n !== r.toSurah + step; n += step) out.push(n);
  return out;
}

/**
 * المدى إلى مقاطع سورة سورة بترتيبه (كما يخزّنها الخادم في recitation_sessions مع seg_index):
 * الأولى من آية البداية إلى آخرها، والوسطى كاملة، والأخيرة من أولها إلى آية النهاية.
 */
export function rangeToSegments(r: QuranRange): Segment[] {
  if (validateRange(r)) return [];
  return surahsOf(r).map(n => {
    const s = surahByNo(n);
    return {
      surah_name: s.name,
      from_ayah: n === r.fromSurah ? r.fromAyah : 1,
      to_ayah: n === r.toSurah ? r.toAyah : s.ayahs,
    };
  });
}

/** هل الآية (s, a) داخل المدى؟ (للتظليل في المصحف وشبكة الآيات، في الاتجاهين). */
export function inRangePos(
  r: QuranRange | null | undefined,
  s: number,
  a: number
): boolean {
  if (!r || validateRange(r)) return false;
  const lo = Math.min(r.fromSurah, r.toSurah);
  const hi = Math.max(r.fromSurah, r.toSurah);
  if (s < lo || s > hi) return false;
  const seg = rangeToSegments(r).find(x => surahNo(x.surah_name) === s);
  return !!seg && a >= seg.from_ayah && a <= seg.to_ayah;
}

/** رقم صفحة الآية في مصحف المدينة (604 صفحات). */
export function pageOf(surah: number, ayah: number): number {
  let lo = 0;
  let hi = PAGE_STARTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const [s, a] = PAGE_STARTS[mid];
    if (s < surah || (s === surah && a <= ayah)) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * يرتّب اختيار المصحف (لمستان بأي ترتيب) إلى مدى صحيح في الاتجاه المطلوب: في السورة الواحدة الآيات
 * تصاعدياً دائماً؛ وعبر السور forward بترتيب المصحف، وbackward من السورة الأكبر رقماً إلى الأصغر.
 */
export function orderPick(
  a: [number, number],
  b: [number, number],
  dir: RangeDirection = "forward"
): QuranRange {
  const asc = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
  let [x, y] = asc ? [a, b] : [b, a];
  if (dir === "backward" && x[0] !== y[0]) [x, y] = [y, x];
  return { fromSurah: x[0], fromAyah: x[1], toSurah: y[0], toAyah: y[1] };
}

/** الآية التي تلي pos في الاتجاه: التالية في سورتها، ثم أول السورة التالية (أو السابقة في backward). */
export function nextPos(
  [s, a]: [number, number],
  dir: RangeDirection = "forward"
): [number, number] {
  const n = surahByNo(s)?.ayahs ?? 0;
  if (a < n) return [s, a + 1];
  const t = dir === "backward" ? s - 1 : s + 1;
  return t >= 1 && t <= SURAHS.length ? [t, 1] : [s, a];
}

/** يطابق البحث بلا تشكيل ولا همزات (أحمد = احمد). */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .toLowerCase()
    .trim();
}
