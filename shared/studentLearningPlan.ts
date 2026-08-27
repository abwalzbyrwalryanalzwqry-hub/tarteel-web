export type LearningRecord = {
  createdAt: Date | string;
  surahNumber: number;
  toSurahNumber?: number | null;
  fromAyah: number;
  toAyah: number;
  pages?: string | number | null;
};

export type AttendanceRecord = { status: string };

function latest<T extends { createdAt: Date | string }>(records: T[]): T | undefined {
  return [...records].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())[0];
}

function pages(records: LearningRecord[]) {
  return records.reduce((total, record) => total + (Number(record.pages ?? 0) || 0), 0);
}

export function buildStudentLearningSummary(input: { memorization: LearningRecord[]; revision: LearningRecord[]; attendance: AttendanceRecord[] }) {
  const latestMemorization = latest(input.memorization);
  const latestRevision = latest(input.revision);
  const attended = input.attendance.filter((record) => record.status === "present").length;
  const absences = input.attendance.filter((record) => record.status === "absent").length;
  const attendanceRate = input.attendance.length ? Math.round((attended / input.attendance.length) * 100) : null;

  return {
    latestMemorization,
    latestRevision,
    memorizationRecordCount: input.memorization.length,
    revisionRecordCount: input.revision.length,
    memorizationPages: pages(input.memorization),
    revisionPages: pages(input.revision),
    attendanceRate,
    absences,
    hasRecordedProgress: Boolean(latestMemorization || latestRevision),
  };
}

export function buildTeacherFollowUpRecommendations(summary: ReturnType<typeof buildStudentLearningSummary>) {
  const recommendations: { tone: "neutral" | "attention" | "positive"; title: string; detail: string }[] = [];
  if (!summary.hasRecordedProgress) recommendations.push({ tone: "neutral", title: "ابدأ بتوثيق التقدم", detail: "لا توجد سجلات حفظ أو مراجعة في الفترة المحددة؛ أضف أول نطاق من سجل الطالب داخل الفترة." });
  if (summary.latestMemorization && !summary.latestRevision) recommendations.push({ tone: "attention", title: "راجع تسجيل المراجعة", detail: "يوجد حفظ موثق في الفترة لكن لا يوجد سجل مراجعة مقابل له ضمن النطاق المعروض." });
  if (summary.attendanceRate !== null && summary.attendanceRate < 80) recommendations.push({ tone: "attention", title: "تابع الحضور", detail: `نسبة الحضور المسجلة هي ${summary.attendanceRate}%، مع ${summary.absences} غياب مسجل.` });
  if (summary.hasRecordedProgress && summary.latestRevision && (summary.attendanceRate === null || summary.attendanceRate >= 80)) recommendations.push({ tone: "positive", title: "السجلات متاحة للمتابعة", detail: "يوجد سجل مراجعة حديث، ويمكن الرجوع إلى النطاقات المسجلة عند إعداد الفترة التالية." });
  return recommendations;
}
