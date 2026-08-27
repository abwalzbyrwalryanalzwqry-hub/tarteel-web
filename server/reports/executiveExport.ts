import XLSX from "xlsx-js-style";
import type { ExecutiveCircleReport } from "./reportBuilder";
import { generateArabicReportPdf } from "../export/reportPdf";
import { configureArabicWorkbook, styleArabicSummary, styleArabicTable, writeArabicWorkbook } from "../export/arabicExcel";

const format = (value: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(value);
const date = (value: Date) => new Date(value).toLocaleDateString("ar-SA");

export function generateExecutiveCirclePdf(report: ExecutiveCircleReport): Promise<Buffer> {
  return generateArabicReportPdf({
    title: "التقرير التنفيذي للحلقة",
    subject: report.meta.circleName,
    details: [report.meta.period === "weekly" ? "ملخص أسبوعي" : "ملخص شهري", `من ${date(report.meta.startDate)}`, `إلى ${date(report.meta.endDate)}`],
    metrics: [{ label: "الفترات المعتمدة", value: report.summary.sessions }, { label: "نسبة الحضور", value: `${report.summary.attendanceRate}%` }, { label: "الحضور", value: report.summary.present }, { label: "الغياب", value: report.summary.absent }, { label: "صفحات الحفظ", value: format(report.summary.memorizedPages) }, { label: "صفحات المراجعة", value: format(report.summary.reviewedPages) }],
    sections: [{ title: report.meta.period === "weekly" ? "تفصيل الأسابيع" : "تفصيل الأشهر", columns: [{ label: "الفترة الزمنية", width: 135 }, { label: "الفترات", width: 62, align: "center" }, { label: "الحضور", width: 62, align: "center" }, { label: "الغياب", width: 62, align: "center" }, { label: "الحفظ", width: 62, align: "center" }, { label: "المراجعة", width: 62, align: "center" }, { label: "صفحات الحفظ", width: 68, align: "center" }], rows: report.buckets.map((bucket) => [bucket.label, bucket.sessions, bucket.present, bucket.absent, bucket.memorizationEntries, bucket.revisionEntries, format(bucket.memorizedPages)]), emptyText: "لا توجد فترات معتمدة ضمن النطاق المحدد." }],
  });
}

export function generateExecutiveCircleExcel(report: ExecutiveCircleReport): Buffer {
  const workbook = XLSX.utils.book_new(); configureArabicWorkbook(workbook);
  const summarySheet = XLSX.utils.aoa_to_sheet([["تقرير ترتيل التنفيذي للحلقة"], ["الحلقة", report.meta.circleName], ["الدورية", report.meta.period === "weekly" ? "أسبوعي" : "شهري"], ["من تاريخ", date(report.meta.startDate)], ["إلى تاريخ", date(report.meta.endDate)], [], ["المؤشر", "القيمة"], ["الفترات المعتمدة", report.summary.sessions], ["حضور", report.summary.present], ["غياب", report.summary.absent], ["استئذان", report.summary.excused], ["تأخر", report.summary.late], ["نسبة الحضور", `${report.summary.attendanceRate}%`], ["سجلات الحفظ", report.summary.memorizationEntries], ["سجلات المراجعة", report.summary.revisionEntries], ["صفحات الحفظ", report.summary.memorizedPages], ["صفحات المراجعة", report.summary.reviewedPages]]);
  const detailSheet = XLSX.utils.aoa_to_sheet([["الفترة الزمنية", "عدد الفترات", "حضور", "غياب", "استئذان", "تأخر", "سجلات الحفظ", "سجلات المراجعة", "صفحات الحفظ", "صفحات المراجعة"], ...report.buckets.map((bucket) => [bucket.label, bucket.sessions, bucket.present, bucket.absent, bucket.excused, bucket.late, bucket.memorizationEntries, bucket.revisionEntries, bucket.memorizedPages, bucket.reviewedPages])]);
  styleArabicSummary(summarySheet, [26, 32]);
  styleArabicTable(detailSheet, { headerRow: 1, widths: [28, 14, 12, 12, 12, 12, 16, 18, 16, 18] });
  XLSX.utils.book_append_sheet(workbook, summarySheet, "الملخص");
  XLSX.utils.book_append_sheet(workbook, detailSheet, "التفصيل الزمني");
  return writeArabicWorkbook(workbook);
}
