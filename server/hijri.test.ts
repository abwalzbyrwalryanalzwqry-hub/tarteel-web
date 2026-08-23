import { describe, expect, it } from "vitest";
import { formatDualCalendarDate, formatHijriDate } from "../shared/dates";

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
});
