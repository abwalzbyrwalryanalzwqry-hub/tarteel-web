import { describe, expect, it } from "vitest";
import { getAttendanceSummary, getQuranRangeError } from "../shared/mizan";

describe("منطق الميزان", () => {
  it("يتحقق من نطاق السور والآيات دون تجاوز حدود المصحف", () => {
    expect(getQuranRangeError({ surahNumber: 1, fromAyah: 1, toAyah: 7 })).toBeNull();
    expect(getQuranRangeError({ surahNumber: 1, fromAyah: 1, toAyah: 8 })).toBe("رقم الآية خارج نطاق السورة المحددة");
    expect(getQuranRangeError({ surahNumber: 3, toSurahNumber: 2, fromAyah: 1, toAyah: 2 })).toBe("نطاق الحفظ أو المراجعة غير صحيح");
    expect(getQuranRangeError({ surahNumber: 2, fromAyah: 40, toAyah: 8 })).toBe("نطاق الحفظ أو المراجعة غير صحيح");
  });

  it("يلخص حالات الحضور للحلقة والجلسة دون خلط الحالات", () => {
    expect(getAttendanceSummary([{ status: "present" }, { status: "present" }, { status: "absent" }, { status: "late" }, { status: "excused" }])).toEqual({ present: 2, absent: 1, late: 1, excused: 1 });
  });
});
