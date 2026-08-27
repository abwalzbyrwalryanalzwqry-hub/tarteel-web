import { describe, expect, it } from "vitest";
import { getAttendanceSummary, getQuranRangeError, MIZAN_RATING_LABELS, scoreToStars } from "../shared/mizan";

describe("منطق الميزان", () => {
  it("يتحقق من نطاق السور والآيات دون تجاوز حدود المصحف", () => {
    expect(getQuranRangeError({ surahNumber: 1, fromAyah: 1, toAyah: 7 })).toBeNull();
    expect(getQuranRangeError({ surahNumber: 1, fromAyah: 1, toAyah: 8 })).toBe("رقم الآية خارج نطاق السورة المحددة");
    expect(getQuranRangeError({ surahNumber: 3, toSurahNumber: 2, fromAyah: 1, toAyah: 2 })).toBeNull();
    expect(getQuranRangeError({ surahNumber: 2, fromAyah: 40, toAyah: 8 })).toBe("نطاق الحفظ أو المراجعة غير صحيح");
    expect(getQuranRangeError({ surahNumber: 107, toSurahNumber: 109, fromAyah: 1, toAyah: 6 })).toBeNull();
    expect(getQuranRangeError({ surahNumber: 114, fromAyah: 6, toAyah: 6 })).toBeNull();
    expect(getQuranRangeError({ surahNumber: 114, fromAyah: 0, toAyah: 1 })).toBe("رقم الآية خارج نطاق السورة المحددة");
    expect(getQuranRangeError({ surahNumber: 115, fromAyah: 1, toAyah: 1 })).toBe("رقم الآية خارج نطاق السورة المحددة");
  });

  it("يلخص حالات الحضور للحلقة والجلسة دون خلط الحالات", () => {
    expect(getAttendanceSummary([{ status: "present" }, { status: "present" }, { status: "absent" }, { status: "late" }, { status: "excused" }])).toEqual({ present: 2, absent: 1, late: 1, excused: 1 });
  });

  it("يحوّل التقييم المئوي إلى نجوم ونص إرشادي متسق", () => {
    expect(scoreToStars(100)).toBe(5);
    expect(scoreToStars(81)).toBe(4);
    expect(scoreToStars(39)).toBe(2);
    expect(scoreToStars(-10)).toBe(0);
    expect(MIZAN_RATING_LABELS[scoreToStars(100)]).toBe("ممتاز");
  });
});
