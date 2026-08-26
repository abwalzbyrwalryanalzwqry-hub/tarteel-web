import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { createRequire } from "node:module";
import { AGE_GROUP_LABELS, type CenterManagementReport } from "./reportBuilder";
import { storageGetSignedUrl } from "../storage";

const require = createRequire(import.meta.url);
const AMIRI_REGULAR = require.resolve("@fontsource/amiri/files/amiri-arabic-400-normal.woff");
const AMIRI_BOLD = require.resolve("@fontsource/amiri/files/amiri-arabic-700-normal.woff");
const PAGE = { left: 40, right: 40, top: 42, bottom: 48 };
const WIDTH = 595.28 - PAGE.left - PAGE.right;
const format = (value: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(value);
const date = (value: Date) => new Date(value).toLocaleDateString("ar-SA");

function filters(report: CenterManagementReport) {
  const values = [`${report.meta.period === "weekly" ? "ملخص أسبوعي" : "ملخص شهري"} · ${date(report.meta.startDate)} — ${date(report.meta.endDate)}`];
  if (report.meta.filters.teacherName) values.push(`المعلم: ${report.meta.filters.teacherName}`);
  if (report.meta.filters.ageGroup) values.push(`الفئة العمرية: ${AGE_GROUP_LABELS[report.meta.filters.ageGroup]}`);
  return values.join(" | ");
}

async function readLogo(report: CenterManagementReport): Promise<Buffer | undefined> {
  if (!report.meta.branding.logoKey) return undefined;
  try {
    const url = await storageGetSignedUrl(report.meta.branding.logoKey);
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length ? bytes : undefined;
  } catch { return undefined; }
}

export async function generateManagementReportPdf(report: CenterManagementReport): Promise<Buffer> {
  const logo = await readLogo(report);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: PAGE.left, bufferPages: true, info: { Title: `تقرير إدارة المركز - ${report.meta.centerName}`, Author: "Tarteel" } });
    doc.registerFont("Amiri", AMIRI_REGULAR); doc.registerFont("AmiriBold", AMIRI_BOLD);
    doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("error", reject); doc.on("end", () => resolve(Buffer.concat(chunks)));
    const rule = (y: number) => doc.moveTo(PAGE.left, y).lineTo(PAGE.left + WIDTH, y).strokeColor("#D9E4DB").lineWidth(.8).stroke();
    const header = () => { const rightWidth = logo ? WIDTH - 64 : WIDTH; if (logo) { try { doc.image(logo, PAGE.left, PAGE.top, { fit: [50, 50] }); } catch { /* شعار غير قابل للعرض */ } } doc.fillColor("#0B4F39").font("AmiriBold").fontSize(18).text(report.meta.branding.headerTitle || report.meta.centerName, PAGE.left + (logo ? 64 : 0), doc.y, { width: rightWidth, align: "right" }); doc.fillColor("#1D2B22").fontSize(15).text("تقرير إدارة المركز", PAGE.left + (logo ? 64 : 0), doc.y, { width: rightWidth, align: "right" }); doc.font("Amiri").fontSize(11).text(report.meta.centerName, PAGE.left + (logo ? 64 : 0), doc.y, { width: rightWidth, align: "right" }); doc.fillColor("#647066").fontSize(8.5).text(filters(report), { align: "right" }); rule(doc.y + 8); doc.moveDown(.9); };
    const ensure = (height: number) => { if (doc.y + height > doc.page.height - PAGE.bottom) { doc.addPage(); header(); } };
    const section = (label: string) => { ensure(32); doc.fillColor("#0B4F39").font("AmiriBold").fontSize(13).text(label, { align: "right" }); doc.moveDown(.4); };
    const row = (values: string[], widths: number[], y: number, headerRow = false) => { let x = PAGE.left; values.forEach((value, index) => { doc.rect(x, y, widths[index], 20).fillAndStroke(headerRow ? "#0B4F39" : "#FFFFFF", "#D9E4DB"); doc.fillColor(headerRow ? "#FFFFFF" : "#1D2B22").font(headerRow ? "AmiriBold" : "Amiri").fontSize(7.6).text(value, x + 3, y + 6, { width: widths[index] - 6, align: index === 0 ? "right" : "center", lineBreak: false }); x += widths[index]; }); };
    header();
    section("الملخص التنفيذي");
    const summary = [`الحلقات النشطة: ${report.summary.activeCircles}`, `الفترات المعتمدة: ${report.summary.sessions}`, `الحضور: ${report.summary.attendanceRate}%`, `صفحات الحفظ: ${format(report.summary.memorizedPages)}`, `صفحات المراجعة: ${format(report.summary.reviewedPages)}`, `سجلات الإنجاز: ${report.summary.memorizationEntries + report.summary.revisionEntries}`];
    doc.fillColor("#1D2B22").font("Amiri").fontSize(10).text(summary.join("  |  "), { align: "right" }); doc.moveDown(.9);
    section("الأهداف والتقدم");
    const goalText = [report.goals.attendanceTarget == null ? "هدف الحضور: غير محدد" : `هدف الحضور: ${report.goals.attendanceTarget}%`, report.goals.projectedMemorizedPagesTarget == null ? "هدف الحفظ: غير محدد" : `هدف الحفظ للنطاق: ${report.goals.projectedMemorizedPagesTarget} صفحة`, report.goals.projectedReviewedPagesTarget == null ? "هدف المراجعة: غير محدد" : `هدف المراجعة للنطاق: ${report.goals.projectedReviewedPagesTarget} صفحة`];
    doc.fillColor("#1D2B22").font("Amiri").fontSize(10).text(goalText.join("  |  "), { align: "right" }); doc.moveDown(.9);
    section("مقارنة الحلقات");
    const widths = [WIDTH * .28, WIDTH * .17, WIDTH * .11, WIDTH * .16, WIDTH * .16, WIDTH * .12];
    let y = doc.y; row(["الحلقة", "المعلم", "الحضور", "الحفظ", "المراجعة", "الفترات"], widths, y, true); y += 20;
    if (!report.comparisons.length) { row(["لا توجد بيانات مقارنة ضمن النطاق.", "", "", "", "", ""], widths, y); doc.y = y + 20; }
    for (const circle of report.comparisons) { ensure(24); y = doc.y; row([circle.circleName, circle.teacherName ?? "غير معين", `${circle.attendanceRate}%`, format(circle.memorizedPages), format(circle.reviewedPages), String(circle.sessions)], widths, y); doc.y = y + 20; }
    section("تنبيهات المتابعة");
    if (!report.alerts.length) doc.fillColor("#1D2B22").font("Amiri").fontSize(10).text("لا توجد تنبيهات تشغيلية ضمن النطاق المحدد.", { align: "right" });
    for (const alert of report.alerts) { ensure(34); doc.fillColor(alert.severity === "warning" ? "#8A5A00" : "#0B4F39").font("AmiriBold").fontSize(10).text(alert.title, { align: "right" }); doc.fillColor("#4B5563").font("Amiri").fontSize(8.8).text(alert.description, { align: "right" }); doc.moveDown(.45); }
    const range = doc.bufferedPageRange(); for (let index = 0; index < range.count; index++) { doc.switchToPage(index); const footerY = doc.page.height - PAGE.bottom - 16; rule(footerY - 8); doc.fillColor("#647066").font("Amiri").fontSize(8).text(report.meta.branding.footerText || "تم التوليد بواسطة تطبيق ترتيل", PAGE.left, footerY, { width: WIDTH / 2, align: "right", lineBreak: false }); doc.text(`${index + 1} / ${range.count}`, PAGE.left + WIDTH / 2, footerY, { width: WIDTH / 2, align: "left", lineBreak: false }); }
    doc.end();
  });
}

export function generateManagementReportExcel(report: CenterManagementReport): Buffer {
  const workbook = XLSX.utils.book_new();
  const overview = XLSX.utils.aoa_to_sheet([
    ["تقرير ترتيل لإدارة المركز"],
    ["المركز", report.meta.centerName], ["الدورية", report.meta.period === "weekly" ? "أسبوعي" : "شهري"], ["من تاريخ", date(report.meta.startDate)], ["إلى تاريخ", date(report.meta.endDate)], ["المعلم", report.meta.filters.teacherName ?? "كل المعلمين"], ["الفئة العمرية", report.meta.filters.ageGroup ? AGE_GROUP_LABELS[report.meta.filters.ageGroup] : "كل الفئات"], [],
    ["المؤشر", "القيمة"], ["الحلقات النشطة", report.summary.activeCircles], ["الفترات المعتمدة", report.summary.sessions], ["نسبة الحضور", `${report.summary.attendanceRate}%`], ["صفحات الحفظ", report.summary.memorizedPages], ["صفحات المراجعة", report.summary.reviewedPages], ["سجلات الحفظ", report.summary.memorizationEntries], ["سجلات المراجعة", report.summary.revisionEntries], [],
    ["الأهداف", "القيمة"], ["هدف الحضور", report.goals.attendanceTarget == null ? "غير محدد" : `${report.goals.attendanceTarget}%`], ["هدف الحفظ للنطاق", report.goals.projectedMemorizedPagesTarget ?? "غير محدد"], ["هدف المراجعة للنطاق", report.goals.projectedReviewedPagesTarget ?? "غير محدد"],
  ]);
  overview["!cols"] = [{ wch: 26 }, { wch: 32 }];
  const comparisons = XLSX.utils.json_to_sheet(report.comparisons.map((circle) => ({ "الحلقة": circle.circleName, "المعلم": circle.teacherName ?? "غير معين", "الفترات": circle.sessions, "نسبة الحضور": `${circle.attendanceRate}%`, "صفحات الحفظ": circle.memorizedPages, "صفحات المراجعة": circle.reviewedPages, "سجلات الإنجاز": circle.activityEntries })));
  comparisons["!cols"] = [{ wch: 24 }, { wch: 24 }, { wch: 13 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
  const alerts = XLSX.utils.json_to_sheet(report.alerts.map((alert) => ({ "الحالة": alert.severity === "warning" ? "تنبيه" : "متابعة", "العنوان": alert.title, "التفاصيل": alert.description, "المعلم": alert.teacherName ?? "—" })));
  alerts["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 68 }, { wch: 24 }];
  const trend = XLSX.utils.json_to_sheet(report.trend.map((item) => ({ "الفترة الزمنية": item.label, "الفترات": item.sessions, "نسبة الحضور": `${item.attendanceRate}%`, "صفحات الحفظ": item.memorizedPages, "صفحات المراجعة": item.reviewedPages })));
  trend["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, overview, "الملخص");
  XLSX.utils.book_append_sheet(workbook, comparisons, "مقارنة الحلقات");
  XLSX.utils.book_append_sheet(workbook, trend, "الاتجاه الزمني");
  XLSX.utils.book_append_sheet(workbook, alerts, "التنبيهات");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
