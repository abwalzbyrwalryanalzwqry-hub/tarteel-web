import type { UnifiedReport } from "./reportBuilder";
import { generateArabicReportPdf } from "../export/reportPdf";

function date(value: Date | null) { return value ? new Date(value).toLocaleDateString("ar-SA") : "كامل البيانات المتاحة"; }

export function generateUnifiedReportPDF(report: UnifiedReport): Promise<Buffer> {
  const activities = report.students.flatMap((block) => [
    ...(report.sections.memorization ? block.memorization : []),
    ...(report.sections.revision ? block.revision : []),
  ].sort((left, right) => right.date.getTime() - left.date.getTime()).map((activity) => [block.student.name, activity.kind === "memorization" ? "حفظ" : "مراجعة", activity.from, activity.to, activity.pages === null ? "—" : String(activity.pages), activity.grade ?? "—", new Date(activity.date).toLocaleDateString("ar-SA")]));
  const evaluations = report.students.flatMap((block) => report.sections.evaluations ? block.evaluations.map((evaluation) => [block.student.name, evaluation.rating, evaluation.score === null ? "—" : `${evaluation.score}/100`, new Date(evaluation.date).toLocaleDateString("ar-SA"), evaluation.notes ?? "—"]) : []);
  const sections = [];
  if (report.sections.attendance) sections.push({ title: "ملخص الحضور حسب الطالب", columns: [{ label: "اسم الطالب", width: 180 }, { label: "حاضر", width: 65, align: "center" as const }, { label: "استئذان", width: 75, align: "center" as const }, { label: "غياب", width: 65, align: "center" as const }, { label: "تأخر", width: 65, align: "center" as const }, { label: "الإجمالي", width: 62, align: "center" as const }], rows: report.students.map((block) => [block.student.name, String(block.attendance.present), String(block.attendance.excused), String(block.attendance.absent), String(block.attendance.late), String(block.attendance.total)]), emptyText: "لا توجد بيانات حضور خلال الفترة المحددة." });
  if (report.sections.memorization || report.sections.revision) sections.push({ title: "تفصيل الحفظ والمراجعة", columns: [{ label: "الطالب", width: 98 }, { label: "النوع", width: 48, align: "center" as const }, { label: "من", width: 95 }, { label: "إلى", width: 95 }, { label: "الصفحات", width: 54, align: "center" as const }, { label: "التقدير", width: 58, align: "center" as const }, { label: "التاريخ", width: 64, align: "center" as const }], rows: activities, emptyText: "لا توجد عمليات حفظ أو مراجعة خلال الفترة المحددة." });
  if (report.sections.evaluations) sections.push({ title: "التقييمات", columns: [{ label: "الطالب", width: 145 }, { label: "التقييم", width: 106 }, { label: "الدرجة", width: 76, align: "center" as const }, { label: "التاريخ", width: 90, align: "center" as const }, { label: "ملاحظات", width: 95 }], rows: evaluations, emptyText: "لا توجد تقييمات خلال الفترة المحددة." });
  if (!sections.length) sections.push({ title: "محتوى التقرير", text: "لم تُحدد أقسام للتصدير في هذا التقرير." });
  return generateArabicReportPdf({
    brandTitle: report.meta.centerName,
    title: report.meta.typeLabel,
    subject: `الحلقة: ${report.meta.circleName}`,
    details: [`من ${date(report.meta.startDate)}`, `إلى ${date(report.meta.endDate)}`, `أُنشئ في ${date(report.meta.generatedAt)}`],
    metrics: [{ label: "الطلاب", value: report.summary.students }, { label: "نسبة الحضور", value: `${report.summary.attendanceRate}%` }, { label: "الحفظ", value: report.summary.memorizationCount }, { label: "المراجعة", value: report.summary.revisionCount }, { label: "متوسط التقييم", value: report.summary.averageScore === null ? "—" : `${report.summary.averageScore}/100` }],
    sections,
  });
}
