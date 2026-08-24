import PDFDocument from "pdfkit";
import { createRequire } from "node:module";
import type { UnifiedReport } from "./reportBuilder";

const require = createRequire(import.meta.url);
const AMIRI_REGULAR = require.resolve("@fontsource/amiri/files/amiri-arabic-400-normal.woff");
const AMIRI_BOLD = require.resolve("@fontsource/amiri/files/amiri-arabic-700-normal.woff");
const PAGE = { left: 42, right: 42, top: 42, bottom: 48 };
const WIDTH = 595.28 - PAGE.left - PAGE.right;

function date(value: Date | null) { return value ? new Date(value).toLocaleDateString("ar-SA") : "كامل البيانات المتاحة"; }
function drawLine(doc: PDFKit.PDFDocument, y: number, color = "#D9E4DB") { doc.moveTo(PAGE.left, y).lineTo(PAGE.left + WIDTH, y).strokeColor(color).lineWidth(0.8).stroke(); }

export function generateUnifiedReportPDF(report: UnifiedReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: PAGE.left, bufferPages: true, info: { Title: report.meta.typeLabel, Author: "Tarteel" } });
    doc.registerFont("Amiri", AMIRI_REGULAR); doc.registerFont("AmiriBold", AMIRI_BOLD);
    doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("error", reject); doc.on("end", () => resolve(Buffer.concat(chunks)));
    const title = () => { doc.fillColor("#0B4F39").font("AmiriBold").fontSize(18).text("ترتيل", { align: "right" }); doc.fillColor("#1D2B22").fontSize(15).text(report.meta.title, { align: "right" }); doc.fillColor("#647066").font("Amiri").fontSize(9).text(`${report.meta.typeLabel} · ${date(report.meta.startDate)} — ${date(report.meta.endDate)}`, { align: "right" }); drawLine(doc, doc.y + 9); doc.moveDown(1); };
    const ensure = (height: number) => { if (doc.y + height > doc.page.height - PAGE.bottom) { doc.addPage(); title(); } };
    const section = (label: string) => { ensure(32); doc.fillColor("#0B4F39").font("AmiriBold").fontSize(13).text(label, { align: "right" }); doc.moveDown(0.35); };
    const row = (values: string[], widths: number[], y: number, header = false) => { let x = PAGE.left; values.forEach((value, index) => { doc.rect(x, y, widths[index], 20).fillAndStroke(header ? "#0B4F39" : "#FFFFFF", "#D9E4DB"); doc.fillColor(header ? "#FFFFFF" : "#1D2B22").font(header ? "AmiriBold" : "Amiri").fontSize(8).text(value, x + 4, y + 6, { width: widths[index] - 8, align: index === 0 ? "right" : "center", lineBreak: false }); x += widths[index]; }); };
    title();
    if (report.sections.summary) { section("ملخص الحلقة"); const values = [`الطلاب: ${report.summary.students}`, `الحضور: ${report.summary.present}`, `الغياب: ${report.summary.absent}`, `نسبة الحضور: ${report.summary.attendanceRate}%`, `الحفظ: ${report.summary.memorizationCount}`, `المراجعة: ${report.summary.revisionCount}`]; doc.font("Amiri").fontSize(9).fillColor("#1D2B22").text(values.join("  |  "), { align: "right" }); doc.moveDown(1); }
    if (report.sections.attendance) { section("بيانات الحضور"); const widths = [WIDTH * .34, WIDTH * .16, WIDTH * .16, WIDTH * .16, WIDTH * .18]; let y = doc.y; row(["الاسم", "الحضور", "الاستئذان", "الغياب", "الإجمالي"], widths, y, true); y += 20; if (!report.students.length) { row(["لا توجد بيانات حضور خلال الفترة المحددة.", "", "", "", ""], widths, y); y += 20; } for (const block of report.students) { ensure(24); y = doc.y; row([block.student.name, String(block.attendance.present), String(block.attendance.excused), String(block.attendance.absent), String(block.attendance.total)], widths, y); doc.y = y + 20; } doc.moveDown(1); }
    if (report.sections.memorization || report.sections.revision || report.sections.evaluations) { section("الحفظ والمراجعة"); for (const block of report.students) { const activities = [...(report.sections.memorization ? block.memorization : []), ...(report.sections.revision ? block.revision : [])].sort((a, b) => b.date.getTime() - a.date.getTime()); const height = Math.max(48, 28 + (activities.length || 1) * 20 + (report.sections.evaluations && block.evaluations.length ? 20 : 0)); ensure(height); doc.fillColor("#F1F5F0").rect(PAGE.left, doc.y, WIDTH, 24).fill(); doc.fillColor("#1D2B22").font("AmiriBold").fontSize(11).text(block.student.name, PAGE.left + 8, doc.y + 7, { width: WIDTH - 16, align: "right" }); doc.moveDown(1.7); const widths = [WIDTH * .12, WIDTH * .25, WIDTH * .25, WIDTH * .12, WIDTH * .14, WIDTH * .12]; let y = doc.y; row(["النوع", "من", "إلى", "الصفحات", "التقدير", "التاريخ"], widths, y, true); y += 20; if (!activities.length) { row(["لا توجد عمليات خلال الفترة المحددة.", "", "", "", "", ""], widths, y); doc.y = y + 20; } for (const activity of activities) { row([activity.kind === "memorization" ? "حفظ" : "مراجعة", activity.from, activity.to, activity.pages === null ? "—" : String(activity.pages), activity.grade ?? "—", new Date(activity.date).toLocaleDateString("ar-SA")], widths, y); y += 20; doc.y = y; } if (report.sections.evaluations && block.evaluations.length) { doc.fillColor("#647066").font("Amiri").fontSize(8).text(`آخر تقييم: ${block.evaluations[0].rating} · ${block.evaluations[0].score ?? "—"}/100`, { align: "right" }); doc.moveDown(.5); } doc.moveDown(.8); } if (!report.students.length) { doc.fillColor("#647066").font("Amiri").fontSize(10).text("لا توجد بيانات طلاب خلال الفترة المحددة.", { align: "right" }); } }
    const range = doc.bufferedPageRange(); for (let index = 0; index < range.count; index++) { doc.switchToPage(index); const footerY = doc.page.height - PAGE.bottom - 16; drawLine(doc, footerY - 8, "#D9E4DB"); doc.fillColor("#647066").font("Amiri").fontSize(8).text("تم التوليد بواسطة تطبيق ترتيل", PAGE.left, footerY, { width: WIDTH / 2, align: "right", lineBreak: false }); doc.text(`${index + 1} / ${range.count}`, PAGE.left + WIDTH / 2, footerY, { width: WIDTH / 2, align: "left", lineBreak: false }); }
    doc.end();
  });
}
