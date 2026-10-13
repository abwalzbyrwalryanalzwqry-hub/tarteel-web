import { AGE_GROUP_LABELS, type CenterManagementReport } from "./reportBuilder";
import { storageRead } from "../storage";
import { generateArabicReportPdf } from "../export/reportPdf";
import { buildArabicWorkbook } from "../export/arabicExcel";

const format = (value: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(value);
const date = (value: Date) => new Date(value).toLocaleDateString("ar-SA");

function filters(report: CenterManagementReport) {
  const values = [report.meta.period === "weekly" ? "ملخص أسبوعي" : "ملخص شهري", `من ${date(report.meta.startDate)}`, `إلى ${date(report.meta.endDate)}`];
  if (report.meta.filters.teacherName) values.push(`المعلم: ${report.meta.filters.teacherName}`);
  if (report.meta.filters.ageGroup) values.push(`الفئة العمرية: ${AGE_GROUP_LABELS[report.meta.filters.ageGroup]}`);
  return values;
}

async function readLogo(report: CenterManagementReport): Promise<Buffer | undefined> {
  if (!report.meta.branding.logoKey) return undefined;
  try { return await storageRead(report.meta.branding.logoKey); } catch { return undefined; }
}

export async function generateManagementReportPdf(report: CenterManagementReport): Promise<Buffer> {
  return generateArabicReportPdf({
    brandTitle: report.meta.branding.headerTitle || report.meta.centerName,
    title: "تقرير إدارة المركز",
    subject: report.meta.centerName,
    details: filters(report),
    logo: await readLogo(report),
    footerText: report.meta.branding.footerText || "تم التوليد بواسطة تطبيق ترتيل",
    metrics: [{ label: "الحلقات النشطة", value: report.summary.activeCircles }, { label: "الطلاب ضمن النطاق", value: report.summary.activeStudents }, { label: "الطلاب بسجل تقدم", value: report.summary.studentsWithRecordedProgress }, { label: "الفترات المعتمدة", value: report.summary.sessions }, { label: "نسبة الحضور", value: `${report.summary.attendanceRate}%` }, { label: "صفحات الحفظ", value: format(report.summary.memorizedPages) }, { label: "صفحات المراجعة", value: format(report.summary.reviewedPages) }, { label: "سجلات الإنجاز", value: report.summary.memorizationEntries + report.summary.revisionEntries }],
    sections: [{ title: "الأهداف والتقدم", text: [report.goals.attendanceTarget == null ? "هدف الحضور: غير محدد" : `هدف الحضور: ${report.goals.attendanceTarget}%`, report.goals.projectedMemorizedPagesTarget == null ? "هدف الحفظ: غير محدد" : `هدف الحفظ للنطاق: ${report.goals.projectedMemorizedPagesTarget} صفحة`, report.goals.projectedReviewedPagesTarget == null ? "هدف المراجعة: غير محدد" : `هدف المراجعة للنطاق: ${report.goals.projectedReviewedPagesTarget} صفحة`, `توثيق تقدم الطلاب: ${report.summary.studentsWithRecordedProgress} من ${report.summary.activeStudents}`].join("  •  ") }, { title: "مقارنة الحلقات", columns: [{ label: "الحلقة", width: 110 }, { label: "المعلم", width: 96 }, { label: "الحضور", width: 58, align: "center" }, { label: "التقدم", width: 78, align: "center" }, { label: "الحفظ", width: 55, align: "center" }, { label: "المراجعة", width: 55, align: "center" }, { label: "الفترات", width: 52, align: "center" }], rows: report.comparisons.map((circle) => [circle.circleName, circle.teacherName ?? "غير معين", `${circle.attendanceRate}%`, `${circle.studentsWithRecordedProgress}/${circle.activeStudents} · ${circle.progressCoverageRate}%`, format(circle.memorizedPages), format(circle.reviewedPages), circle.sessions]), emptyText: "لا توجد بيانات مقارنة ضمن النطاق." }, { title: "تنبيهات المتابعة", columns: [{ label: "الحالة", width: 70, align: "center" }, { label: "العنوان", width: 170 }, { label: "التفاصيل", width: 270 }], rows: report.alerts.map((alert) => [alert.severity === "warning" ? "تنبيه" : "متابعة", alert.title, alert.description]), emptyText: "لا توجد تنبيهات تشغيلية ضمن النطاق المحدد." }],
  });
}

export function generateManagementReportExcel(report: CenterManagementReport): Buffer {
  return buildArabicWorkbook([
    { name: "الملخص", layout: "summary", widths: [26, 32], rows: [["تقرير ترتيل لإدارة المركز"], ["المركز", report.meta.centerName], ["الدورية", report.meta.period === "weekly" ? "أسبوعي" : "شهري"], ["من تاريخ", date(report.meta.startDate)], ["إلى تاريخ", date(report.meta.endDate)], ["المعلم", report.meta.filters.teacherName ?? "كل المعلمين"], ["الفئة العمرية", report.meta.filters.ageGroup ? AGE_GROUP_LABELS[report.meta.filters.ageGroup] : "كل الفئات"], [], ["المؤشر", "القيمة"], ["الحلقات النشطة", report.summary.activeCircles], ["الطلاب ضمن النطاق", report.summary.activeStudents], ["الطلاب بسجل تقدم", report.summary.studentsWithRecordedProgress], ["الطلاب بلا سجل تقدم", report.summary.studentsWithoutRecordedProgress], ["الفترات المعتمدة", report.summary.sessions], ["نسبة الحضور", `${report.summary.attendanceRate}%`], ["صفحات الحفظ", report.summary.memorizedPages], ["صفحات المراجعة", report.summary.reviewedPages], ["سجلات الحفظ", report.summary.memorizationEntries], ["سجلات المراجعة", report.summary.revisionEntries], [], ["الأهداف", "القيمة"], ["هدف الحضور", report.goals.attendanceTarget == null ? "غير محدد" : `${report.goals.attendanceTarget}%`], ["هدف الحفظ للنطاق", report.goals.projectedMemorizedPagesTarget ?? "غير محدد"], ["هدف المراجعة للنطاق", report.goals.projectedReviewedPagesTarget ?? "غير محدد"]] },
    { name: "مقارنة الحلقات", layout: "table", widths: [24, 24, 12, 16, 20, 17, 18, 17], rows: [["الحلقة", "المعلم", "الفترات", "نسبة الحضور", "توثيق التقدم", "صفحات الحفظ", "صفحات المراجعة", "سجلات الإنجاز"], ...report.comparisons.map((circle) => [circle.circleName, circle.teacherName ?? "غير معين", circle.sessions, `${circle.attendanceRate}%`, `${circle.studentsWithRecordedProgress}/${circle.activeStudents} · ${circle.progressCoverageRate}%`, circle.memorizedPages, circle.reviewedPages, circle.activityEntries])] },
    { name: "الاتجاه الزمني", layout: "table", widths: [28, 15, 18, 18, 20], rows: [["الفترة الزمنية", "الفترات", "نسبة الحضور", "صفحات الحفظ", "صفحات المراجعة"], ...report.trend.map((item) => [item.label, item.sessions, `${item.attendanceRate}%`, item.memorizedPages, item.reviewedPages])] },
    { name: "التنبيهات", layout: "table", widths: [14, 34, 68, 24], rows: [["الحالة", "العنوان", "التفاصيل", "المعلم"], ...report.alerts.map((alert) => [alert.severity === "warning" ? "تنبيه" : "متابعة", alert.title, alert.description, alert.teacherName ?? "—"])] },
  ]);
}
