/**
 * نموذج التصدير المشترك (ExportDoc) كما في زِن، وتحويله إلى ملف Excel عربي من اليمين لليسار. يستعمله
 * تصدير التقارير (lib/reports/export.ts): ورقة «الملخص» أولاً ثم ورقة لكل جدول.
 */
import {
  buildArabicWorkbook,
  type ArabicSheet,
} from "@/mushaf/lib/arabic-xlsx";

export type Cell = string | number | null;
export type ExportSheet = { title: string; columns: string[]; rows: Cell[][] };
export type ExportDoc = {
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
  sheets: ExportSheet[];
};

/** اسم ورقة Excel: 31 حرفاً كحد أقصى وبلا الرموز الممنوعة. */
export function sheetName(title: string, used: Set<string>): string {
  const base =
    title
      .replace(/[\\/?*[\]:]/g, " ")
      .trim()
      .slice(0, 28) || "ورقة";
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base} ${i++}`;
  used.add(name);
  return name;
}

/** لون رأس الجداول الافتراضي: أخضر ترتيل (يقرأ عليه النص الأبيض). */
const HEADER_BG = "#0B4F39";

/** فاتح من لون الرأس للصفوف المتناوبة. */
function zebraOf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#F1F6F2";
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.92);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

/** الأوراق كما تُكتب: الملخص أولاً ثم ورقة لكل جدول. */
export function workbookSheets(doc: ExportDoc): ArabicSheet[] {
  const used = new Set<string>();
  const summary: ArabicSheet = {
    name: sheetName("الملخص", used),
    layout: "summary",
    widths: [28, 18],
    rows: [
      [doc.title],
      [doc.subtitle],
      [],
      ...doc.stats.map(s => [s.label, s.value]),
    ],
  };
  const tables = doc.sheets.map((s): ArabicSheet => ({
    name: sheetName(s.title, used),
    layout: "table",
    widths: s.columns.map((col, i) => {
      const longest = Math.max(
        col.length,
        ...s.rows.map(r => String(r[i] ?? "").length)
      );
      return Math.min(Math.max(longest + 2, 8), 50);
    }),
    rows: [s.columns, ...s.rows],
  }));
  return [summary, ...tables];
}

/** ملف Excel (xlsx) من اليمين لليسار بلون رأس التقرير. */
export async function excelBlob(
  doc: ExportDoc,
  headerBg: string = HEADER_BG
): Promise<Blob> {
  const bytes = buildArabicWorkbook(workbookSheets(doc), {
    header: headerBg,
    zebra: zebraOf(headerBg),
  });
  return new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
