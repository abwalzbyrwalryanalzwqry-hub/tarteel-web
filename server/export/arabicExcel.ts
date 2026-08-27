import XLSX from "xlsx-js-style";
import AdmZip from "adm-zip";

const border = { top: { style: "thin", color: { rgb: "D9E4DB" } }, bottom: { style: "thin", color: { rgb: "D9E4DB" } }, left: { style: "thin", color: { rgb: "D9E4DB" } }, right: { style: "thin", color: { rgb: "D9E4DB" } } } as const;

type StyledSheet = XLSX.WorkSheet & { "!pageSetup"?: Record<string, unknown>; "!margins"?: Record<string, number>; "!autofilter"?: { ref: string }; "!rows"?: Array<{ hpt?: number }> };

export function configureArabicWorkbook(workbook: XLSX.WorkBook) {
  workbook.Workbook ??= {};
  workbook.Workbook.Views = [{ RTL: true }];
}

export function writeArabicWorkbook(workbook: XLSX.WorkBook): Buffer {
  const archive = new AdmZip(XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true }) as Buffer);
  const pageSetup = '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>';
  archive.getEntries().filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.entryName)).forEach((entry) => {
    const source = entry.getData().toString("utf8");
    const withSheetProperties = source.includes("<sheetPr>")
      ? source.replace("<sheetPr>", '<sheetPr><pageSetUpPr fitToPage="1"/>')
      : source.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    archive.updateFile(entry.entryName, Buffer.from(withSheetProperties.replace("</worksheet>", `${pageSetup}</worksheet>`), "utf8"));
  });
  return archive.toBuffer();
}

export function styleArabicTable(sheet: XLSX.WorkSheet, options: { headerRow: number; widths: number[]; titleRow?: number; filter?: boolean }) {
  const worksheet = sheet as StyledSheet;
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  worksheet["!cols"] = options.widths.map((wch) => ({ wch }));
  worksheet["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  worksheet["!margins"] = { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.15, footer: 0.15 };
  worksheet["!rows"] = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address];
      if (!cell) continue;
      cell.s = { font: { name: "Arial", sz: 10, color: { rgb: "1D2B22" } }, alignment: { horizontal: "right", vertical: "center", wrapText: true, readingOrder: 2 }, border, fill: { fgColor: { rgb: row % 2 === 0 ? "F8FBF8" : "FFFFFF" } } };
    }
  }
  const headerIndex = options.headerRow - 1;
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: headerIndex, c: column })];
    if (cell) cell.s = { font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true, readingOrder: 2 }, border, fill: { fgColor: { rgb: "0B4F39" } } };
  }
  worksheet["!rows"][headerIndex] = { hpt: 28 };
  if (options.titleRow) {
    const titleIndex = options.titleRow - 1;
    const titleCell = worksheet[XLSX.utils.encode_cell({ r: titleIndex, c: range.s.c })];
    if (titleCell) titleCell.s = { font: { name: "Arial", sz: 15, bold: true, color: { rgb: "0B4F39" } }, alignment: { horizontal: "right", vertical: "center", readingOrder: 2 } };
    worksheet["!rows"][titleIndex] = { hpt: 30 };
  }
  if (options.filter !== false && range.e.r > headerIndex) worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerIndex, c: range.s.c }, e: range.e }) };
}

export function styleArabicSummary(sheet: XLSX.WorkSheet, widths: number[]) {
  styleArabicTable(sheet, { headerRow: 1, widths, titleRow: 1, filter: false });
  const worksheet = sheet as StyledSheet;
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:A1");
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    const label = worksheet[XLSX.utils.encode_cell({ r: row, c: range.s.c })];
    if (label) label.s = { font: { name: "Arial", sz: 10, bold: true, color: { rgb: "0B4F39" } }, alignment: { horizontal: "right", vertical: "center", wrapText: true, readingOrder: 2 }, border, fill: { fgColor: { rgb: "F1F6F2" } } };
  }
}
