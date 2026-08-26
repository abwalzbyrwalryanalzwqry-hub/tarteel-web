import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { createRequire } from "node:module";
import type { ExecutiveCircleReport } from "./reportBuilder";

const require = createRequire(import.meta.url);
const AMIRI_REGULAR = require.resolve("@fontsource/amiri/files/amiri-arabic-400-normal.woff");
const AMIRI_BOLD = require.resolve("@fontsource/amiri/files/amiri-arabic-700-normal.woff");
const PAGE = { left: 42, right: 42, top: 42, bottom: 48 };
const WIDTH = 595.28 - PAGE.left - PAGE.right;

const format = (value: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(value);
const date = (value: Date) => new Date(value).toLocaleDateString("ar-SA");

export function generateExecutiveCirclePdf(report: ExecutiveCircleReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: PAGE.left, bufferPages: true, info: { Title: `التقرير التنفيذي - ${report.meta.circleName}`, Author: "Tarteel" } });
    doc.registerFont("Amiri", AMIRI_REGULAR); doc.registerFont("AmiriBold", AMIRI_BOLD);
    doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("error", reject); doc.on("end", () => resolve(Buffer.concat(chunks)));
    const line = (y: number) => doc.moveTo(PAGE.left, y).lineTo(PAGE.left + WIDTH, y).strokeColor("#D9E4DB").lineWidth(0.8).stroke();
    const title = () => { doc.fillColor("#0B4F39").font("AmiriBold").fontSize(18).text("ترتيل", { align: "right" }); doc.fillColor("#1D2B22").fontSize(15).text("التقرير التنفيذي للحلقة", { align: "right" }); doc.font("Amiri").fontSize(11).text(report.meta.circleName, { align: "right" }); doc.fillColor("#647066").fontSize(9).text(`${report.meta.period === "weekly" ? "ملخص أسبوعي" : "ملخص شهري"} · ${date(report.meta.startDate)} — ${date(report.meta.endDate)}`, { align: "right" }); line(doc.y + 8); doc.moveDown(1); };
    const ensure = (height: number) => { if (doc.y + height > doc.page.height - PAGE.bottom) { doc.addPage(); title(); } };
    const section = (label: string) => { ensure(32); doc.fillColor("#0B4F39").font("AmiriBold").fontSize(13).text(label, { align: "right" }); doc.moveDown(0.45); };
    const row = (values: string[], widths: number[], y: number, header = false) => { let x = PAGE.left; values.forEach((value, index) => { doc.rect(x, y, widths[index], 20).fillAndStroke(header ? "#0B4F39" : "#FFFFFF", "#D9E4DB"); doc.fillColor(header ? "#FFFFFF" : "#1D2B22").font(header ? "AmiriBold" : "Amiri").fontSize(8).text(value, x + 4, y + 6, { width: widths[index] - 8, align: index === 0 ? "right" : "center", lineBreak: false }); x += widths[index]; }); };
    title();
    section("الملخص التنفيذي");
    const summary = [`الفترات: ${report.summary.sessions}`, `الحضور: ${report.summary.present}`, `الغياب: ${report.summary.absent}`, `نسبة الحضور: ${report.summary.attendanceRate}%`, `سجلات الحفظ: ${report.summary.memorizationEntries}`, `سجلات المراجعة: ${report.summary.revisionEntries}`, `صفحات الحفظ: ${format(report.summary.memorizedPages)}`, `صفحات المراجعة: ${format(report.summary.reviewedPages)}`];
    doc.fillColor("#1D2B22").font("Amiri").fontSize(10).text(summary.join("  |  "), { align: "right" }); doc.moveDown(1);
    section(report.meta.period === "weekly" ? "تفصيل الأسابيع" : "تفصيل الأشهر");
    const widths = [WIDTH * .27, WIDTH * .10, WIDTH * .11, WIDTH * .10, WIDTH * .12, WIDTH * .12, WIDTH * .09, WIDTH * .09];
    let y = doc.y; row(["الفترة الزمنية", "الفترات", "الحضور", "الغياب", "الحفظ", "المراجعة", "صفحات حفظ", "صفحات مراجعة"], widths, y, true); y += 20;
    if (!report.buckets.length) { row(["لا توجد فترات معتمدة ضمن النطاق المحدد.", "", "", "", "", "", "", ""], widths, y); doc.y = y + 20; }
    for (const bucket of report.buckets) { ensure(24); y = doc.y; row([bucket.label, String(bucket.sessions), String(bucket.present), String(bucket.absent), String(bucket.memorizationEntries), String(bucket.revisionEntries), format(bucket.memorizedPages), format(bucket.reviewedPages)], widths, y); doc.y = y + 20; }
    const range = doc.bufferedPageRange(); for (let index = 0; index < range.count; index++) { doc.switchToPage(index); const footerY = doc.page.height - PAGE.bottom - 16; line(footerY - 8); doc.fillColor("#647066").font("Amiri").fontSize(8).text("تم التوليد بواسطة تطبيق ترتيل", PAGE.left, footerY, { width: WIDTH / 2, align: "right", lineBreak: false }); doc.text(`${index + 1} / ${range.count}`, PAGE.left + WIDTH / 2, footerY, { width: WIDTH / 2, align: "left", lineBreak: false }); }
    doc.end();
  });
}

export function generateExecutiveCircleExcel(report: ExecutiveCircleReport): Buffer {
  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["تقرير ترتيل التنفيذي للحلقة"],
    ["الحلقة", report.meta.circleName],
    ["الدورية", report.meta.period === "weekly" ? "أسبوعي" : "شهري"],
    ["من تاريخ", date(report.meta.startDate)],
    ["إلى تاريخ", date(report.meta.endDate)],
    [],
    ["المؤشر", "القيمة"],
    ["الفترات المعتمدة", report.summary.sessions],
    ["حضور", report.summary.present],
    ["غياب", report.summary.absent],
    ["استئذان", report.summary.excused],
    ["تأخر", report.summary.late],
    ["نسبة الحضور", `${report.summary.attendanceRate}%`],
    ["سجلات الحفظ", report.summary.memorizationEntries],
    ["سجلات المراجعة", report.summary.revisionEntries],
    ["صفحات الحفظ", report.summary.memorizedPages],
    ["صفحات المراجعة", report.summary.reviewedPages],
  ]);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 28 }];
  const detailSheet = XLSX.utils.json_to_sheet(report.buckets.map((bucket) => ({ "الفترة الزمنية": bucket.label, "عدد الفترات": bucket.sessions, "حضور": bucket.present, "غياب": bucket.absent, "استئذان": bucket.excused, "تأخر": bucket.late, "سجلات الحفظ": bucket.memorizationEntries, "سجلات المراجعة": bucket.revisionEntries, "صفحات الحفظ": bucket.memorizedPages, "صفحات المراجعة": bucket.reviewedPages })));
  detailSheet["!cols"] = [{ wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 17 }, { wch: 15 }, { wch: 17 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "الملخص");
  XLSX.utils.book_append_sheet(workbook, detailSheet, "التفصيل الزمني");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
