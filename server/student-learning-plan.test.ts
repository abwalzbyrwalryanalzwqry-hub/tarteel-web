import { describe, expect, it } from "vitest";
import { buildStudentLearningSummary, buildTeacherFollowUpRecommendations } from "../shared/studentLearningPlan";

describe("ملخص متابعة الطالب", () => {
  it("يعرض آخر موضع وسجلات الفترة من بيانات موثقة فقط", () => {
    const summary = buildStudentLearningSummary({
      memorization: [
        { createdAt: "2026-08-02T12:00:00.000Z", surahNumber: 2, fromAyah: 1, toAyah: 5, pages: "0.5" },
        { createdAt: "2026-08-03T12:00:00.000Z", surahNumber: 2, fromAyah: 6, toAyah: 10, pages: "0.5" },
      ],
      revision: [{ createdAt: "2026-08-04T12:00:00.000Z", surahNumber: 1, fromAyah: 1, toAyah: 7, pages: "1" }],
      attendance: [{ status: "present" }, { status: "absent" }, { status: "present" }],
    });
    expect(summary.latestMemorization?.toAyah).toBe(10);
    expect(summary.latestRevision?.surahNumber).toBe(1);
    expect(summary.memorizationPages).toBe(1);
    expect(summary.revisionPages).toBe(1);
    expect(summary.attendanceRate).toBe(67);
    expect(summary.absences).toBe(1);
  });

  it("لا يضع نسبة حضور أو موضعاً متخيلاً عند غياب السجلات", () => {
    const summary = buildStudentLearningSummary({ memorization: [], revision: [], attendance: [] });
    expect(summary.latestMemorization).toBeUndefined();
    expect(summary.latestRevision).toBeUndefined();
    expect(summary.attendanceRate).toBeNull();
    expect(summary.hasRecordedProgress).toBe(false);
  });

  it("يقدم تنبيهاً قابلاً للتفسير عند وجود حفظ بلا مراجعة أو حضور منخفض", () => {
    const summary = buildStudentLearningSummary({
      memorization: [{ createdAt: "2026-08-03T12:00:00.000Z", surahNumber: 2, fromAyah: 1, toAyah: 5 }],
      revision: [], attendance: [{ status: "present" }, { status: "absent" }],
    });
    expect(buildTeacherFollowUpRecommendations(summary)).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "راجع تسجيل المراجعة", tone: "attention" }),
      expect.objectContaining({ title: "تابع الحضور", tone: "attention" }),
    ]));
  });
});
