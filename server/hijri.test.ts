import { describe, expect, it } from "vitest";
import { formatDualCalendarDate, formatHijriDate, getHijriDateParts, getRiyadhDayKey, hijriToGregorian } from "../shared/dates";

describe("التاريخ الهجري", () => {
  it("يعرض تاريخاً هجرياً صالحاً لتاريخ ميلادي معروف", () => {
    const result = formatHijriDate("2026-08-24T00:00:00.000Z");
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(4);
  });

  it("يعرض التاريخين الهجري والميلادي معاً", () => {
    const result = formatDualCalendarDate("2026-08-24T00:00:00.000Z");
    expect(result.gregorian).not.toBe("—");
    expect(result.hijri).not.toBe("—");
  });

  it("يعيد تحويل التاريخ الهجري اليدوي إلى يوم ميلادي مطابق", () => {
    const original = new Date("2026-08-24T00:00:00.000Z");
    const hijri = getHijriDateParts(original);
    expect(hijri).not.toBeNull();
    const restored = hijriToGregorian(hijri!);
    expect(restored).not.toBeNull();
    expect(getHijriDateParts(restored!)).toEqual(hijri);
    expect(hijriToGregorian({ year: 1448, month: 13, day: 1 })).toBeNull();
  });

  it("يفصل الفترة بحسب التاريخ المختار بتوقيت السعودية لا بحسب وقت إنشائها", () => {
    expect(getRiyadhDayKey("2026-08-24T21:30:00.000Z")).toBe("2026-08-25");
    expect(getRiyadhDayKey("2026-08-25T20:59:00.000Z")).toBe("2026-08-25");
  });
});
