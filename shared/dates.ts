/** تنسيق تاريخ هجري باستخدام تقويم أم القرى المضمّن في بيئة المتصفح والخادم. */
export function formatHijriDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDualCalendarDate(value: string | number | Date): { gregorian: string; hijri: string } {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return { gregorian: "—", hijri: "—" };

  return {
    gregorian: date.toLocaleDateString("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    hijri: formatHijriDate(date),
  };
}

export type HijriDateParts = { year: number; month: number; day: number };

/** مفتاح اليوم التشغيلي في توقيت السعودية، ليبقى لكل حلقة سجل واحد في اليوم نفسه. */
export function getRiyadhDayKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("تاريخ الفترة غير صالح");
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Riyadh" }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = valueOf("year");
  const month = valueOf("month");
  const day = valueOf("day");
  if (!year || !month || !day) throw new Error("تعذر تحديد يوم الفترة");
  return `${year}-${month}-${day}`;
}

export function getHijriDateParts(value: string | number | Date): HijriDateParts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).formatToParts(date);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = number("year");
  const month = number("month");
  const day = number("day");
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? { year, month, day } : null;
}

/** يحول تاريخ أم القرى المدخل يدوياً إلى ميلادي بالبحث حول السنة التقديرية. */
export function hijriToGregorian({ year, month, day }: HijriDateParts): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 30) return null;
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
  const estimatedGregorianYear = year + 579;
  const start = Date.UTC(estimatedGregorianYear - 2, 0, 1);
  const end = Date.UTC(estimatedGregorianYear + 1, 11, 31);
  for (let timestamp = start; timestamp <= end; timestamp += 86_400_000) {
    const parts = formatter.formatToParts(new Date(timestamp));
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    if (value("year") === year && value("month") === month && value("day") === day) return new Date(timestamp);
  }
  return null;
}
