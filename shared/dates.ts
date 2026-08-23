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
