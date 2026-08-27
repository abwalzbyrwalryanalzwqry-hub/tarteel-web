import PDFDocument from "pdfkit";
import { createRequire } from "node:module";
import { ARABIC_PDF_PAGE, ARABIC_PDF_WIDTH, toArabicPdfText, truncatePdfValue } from "./arabicPdf";

const require = createRequire(import.meta.url);
const AMIRI_REGULAR = require.resolve("@fontsource/amiri/files/amiri-arabic-400-normal.woff");
const AMIRI_BOLD = require.resolve("@fontsource/amiri/files/amiri-arabic-700-normal.woff");
const BOTTOM_LIMIT = 841.89 - ARABIC_PDF_PAGE.bottom;

export interface ArabicPdfColumn { label: string; width: number; align?: "right" | "center" | "left"; }
export interface ArabicPdfSection { title: string; columns?: ArabicPdfColumn[]; rows?: Array<Array<string | number | null | undefined>>; text?: string; emptyText?: string; }
export interface ArabicPdfMetric { label: string; value: string | number; }
export interface ArabicPdfReport {
  title: string;
  brandTitle?: string;
  subject?: string;
  details?: string[];
  metrics?: ArabicPdfMetric[];
  sections: ArabicPdfSection[];
  footerText?: string;
  logo?: Buffer;
}

function registerFonts(doc: PDFKit.PDFDocument) { doc.registerFont("TarteelArabic", AMIRI_REGULAR); doc.registerFont("TarteelArabicBold", AMIRI_BOLD); }
function drawRule(doc: PDFKit.PDFDocument, y: number) { doc.moveTo(ARABIC_PDF_PAGE.left, y).lineTo(ARABIC_PDF_PAGE.left + ARABIC_PDF_WIDTH, y).lineWidth(0.8).strokeColor("#D9E4DB").stroke(); }
function alignedText(doc: PDFKit.PDFDocument, value: string | number | null | undefined, x: number, y: number, width: number, size: number, options: { bold?: boolean; color?: string; align?: "right" | "center" | "left"; limit?: number } = {}) {
  doc.fillColor(options.color ?? "#1D2B22").font(options.bold ? "TarteelArabicBold" : "TarteelArabic").fontSize(size).text(toArabicPdfText(value, options.limit), x, y, { width, align: options.align ?? "right", lineGap: 1 });
}

function header(doc: PDFKit.PDFDocument, report: ArabicPdfReport) {
  const titleWidth = report.logo ? ARABIC_PDF_WIDTH - 64 : ARABIC_PDF_WIDTH;
  if (report.logo) { try { doc.image(report.logo, ARABIC_PDF_PAGE.left, ARABIC_PDF_PAGE.top, { fit: [48, 48] }); } catch { /* يحتفظ التقرير بترويسة نصية إذا لم يصلح الشعار للطباعة. */ } }
  const x = ARABIC_PDF_PAGE.left + (report.logo ? 64 : 0);
  alignedText(doc, report.brandTitle ?? "ترتيل", x, ARABIC_PDF_PAGE.top, titleWidth, 18, { bold: true, color: "#0B4F39" });
  alignedText(doc, report.title, x, ARABIC_PDF_PAGE.top + 22, titleWidth, 14.5, { bold: true });
  if (report.subject) alignedText(doc, report.subject, x, ARABIC_PDF_PAGE.top + 42, titleWidth, 9.5, { color: "#647066" });
  const headerHeight = report.subject ? 62 : 48;
  drawRule(doc, ARABIC_PDF_PAGE.top + headerHeight + 7);
  doc.y = ARABIC_PDF_PAGE.top + headerHeight + 17;
}

function ensureSpace(doc: PDFKit.PDFDocument, report: ArabicPdfReport, height: number) {
  if (doc.y + height <= BOTTOM_LIMIT) return;
  doc.addPage();
  header(doc, report);
}

function drawMetrics(doc: PDFKit.PDFDocument, report: ArabicPdfReport) {
  if (!report.metrics?.length) return;
  const metricWidth = (ARABIC_PDF_WIDTH - 16) / 3;
  const rows = Math.ceil(report.metrics.length / 3);
  ensureSpace(doc, report, rows * 48 + 6);
  const startY = doc.y;
  report.metrics.forEach((metric, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = ARABIC_PDF_PAGE.left + ARABIC_PDF_WIDTH - metricWidth * (col + 1) - col * 8;
    const y = startY + row * 48;
    doc.roundedRect(x, y, metricWidth, 40, 7).fillAndStroke("#F1F6F2", "#D9E4DB");
    alignedText(doc, metric.label, x + 7, y + 6, metricWidth - 14, 7.8, { color: "#647066", limit: 28 });
    alignedText(doc, metric.value, x + 7, y + 20, metricWidth - 14, 11, { bold: true, color: "#0B4F39", limit: 24 });
  });
  doc.y = startY + rows * 48 + 4;
}

function cellHeight(doc: PDFKit.PDFDocument, value: string | number | null | undefined, width: number) {
  return Math.max(28, Math.min(54, doc.font("TarteelArabic").fontSize(8.2).heightOfString(toArabicPdfText(value, 64), { width: Math.max(16, width - 12), align: "right", lineGap: 1 }) + 12));
}

function drawTableHeader(doc: PDFKit.PDFDocument, columns: ArabicPdfColumn[]) {
  const y = doc.y;
  let x = ARABIC_PDF_PAGE.left + ARABIC_PDF_WIDTH;
  columns.forEach((column) => {
    x -= column.width;
    doc.rect(x, y, column.width, 25).fillAndStroke("#0B4F39", "#0B4F39");
    alignedText(doc, column.label, x + 5, y + 7, column.width - 10, 8, { bold: true, color: "#FFFFFF", align: column.align ?? "right", limit: 30 });
  });
  doc.y = y + 25;
}

function drawTableRow(doc: PDFKit.PDFDocument, columns: ArabicPdfColumn[], values: Array<string | number | null | undefined>, stripe: boolean) {
  const height = Math.max(...columns.map((column, index) => cellHeight(doc, values[index], column.width)));
  const y = doc.y;
  let x = ARABIC_PDF_PAGE.left + ARABIC_PDF_WIDTH;
  columns.forEach((column, index) => {
    x -= column.width;
    doc.rect(x, y, column.width, height).fillAndStroke(stripe ? "#F8FBF8" : "#FFFFFF", "#D9E4DB");
    alignedText(doc, values[index], x + 6, y + 7, column.width - 12, 8.2, { align: column.align ?? "right", limit: 64 });
  });
  doc.y = y + height;
}

function drawTable(doc: PDFKit.PDFDocument, report: ArabicPdfReport, section: ArabicPdfSection) {
  const columns = section.columns ?? [];
  const rows = section.rows?.length ? section.rows : [[section.emptyText ?? "لا توجد بيانات ضمن النطاق المحدد.", ...Array(Math.max(0, columns.length - 1)).fill("")]];
  ensureSpace(doc, report, 57);
  drawTableHeader(doc, columns);
  rows.forEach((values, index) => {
    const height = Math.max(...columns.map((column, cellIndex) => cellHeight(doc, values[cellIndex], column.width)));
    if (doc.y + height > BOTTOM_LIMIT) { doc.addPage(); header(doc, report); drawTableHeader(doc, columns); }
    drawTableRow(doc, columns, values, index % 2 === 1);
  });
  doc.moveDown(.8);
}

function drawSection(doc: PDFKit.PDFDocument, report: ArabicPdfReport, section: ArabicPdfSection) {
  ensureSpace(doc, report, 34);
  alignedText(doc, section.title, ARABIC_PDF_PAGE.left, doc.y, ARABIC_PDF_WIDTH, 12.5, { bold: true, color: "#0B4F39" });
  doc.moveDown(.45);
  if (section.columns?.length) drawTable(doc, report, section);
  else if (section.text) { alignedText(doc, truncatePdfValue(section.text, 260), ARABIC_PDF_PAGE.left, doc.y, ARABIC_PDF_WIDTH, 9.5, { color: "#34443B", limit: 260 }); doc.moveDown(1.05); }
}

function drawFooters(doc: PDFKit.PDFDocument, report: ArabicPdfReport) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);
    const y = doc.page.height - ARABIC_PDF_PAGE.bottom - 16;
    drawRule(doc, y - 8);
    alignedText(doc, report.footerText ?? "تم التوليد بواسطة تطبيق ترتيل", ARABIC_PDF_PAGE.left, y, ARABIC_PDF_WIDTH * .68, 8, { color: "#647066", limit: 80 });
    alignedText(doc, `صفحة ${index + 1} من ${range.count}`, ARABIC_PDF_PAGE.left + ARABIC_PDF_WIDTH * .62, y, ARABIC_PDF_WIDTH * .38, 8, { color: "#647066", align: "left" });
  }
}

export function generateArabicReportPdf(report: ArabicPdfReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: ARABIC_PDF_PAGE.left, bufferPages: true, info: { Title: report.title, Author: "Tarteel" } });
    registerFonts(doc);
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    header(doc, report);
    if (report.details?.length) { alignedText(doc, report.details.join("  •  "), ARABIC_PDF_PAGE.left, doc.y, ARABIC_PDF_WIDTH, 9, { color: "#647066", limit: 220 }); doc.moveDown(1); }
    drawMetrics(doc, report);
    report.sections.forEach((section) => drawSection(doc, report, section));
    drawFooters(doc, report);
    doc.end();
  });
}
