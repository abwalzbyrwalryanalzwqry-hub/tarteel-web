/**
 * مولّد ملفات Excel (xlsx) عربية لتقارير السجل اليومي في المتصفح، بلا مكتبة جداول خارجية: ملف xlsx حزمة
 * ZIP فيها ملفات XML ثابتة البنية، فنكتبها بأنفسنا ونضغطها بـ fflate.
 *
 * كل ورقة: اتجاه من اليمين لليسار، وطباعة أفقية على A4 بملاءمة العرض، وخط Arial، ورأس جدول بلون
 * التقرير (لون ترتيل افتراضياً)، وصفوف متناوبة، وفلتر تلقائي لجداول التفصيل، وصف العناوين مثبّت.
 */
import { strToU8, zipSync } from "fflate";

export type XlsxCell = string | number | null | undefined;

export interface ArabicSheet {
  /** اسم الورقة (يُقص إلى 31 حرفاً وتُحذف منه الرموز التي يمنعها Excel). */
  name: string;
  rows: XlsxCell[][];
  /** عرض كل عمود بعدد الحروف التقريبي. */
  widths: number[];
  /**
   * table: الصف الأول رأس جدول ملون، مع فلتر تلقائي.
   * summary: الصف الأول عنوان كبير، والعمود الأول تسميات بخط عريض.
   */
  layout: "table" | "summary";
}

// ── أنماط الخلايا (فهارس cellXfs في styles.xml) ──
const STYLE = { bodyEven: 1, bodyOdd: 2, header: 3, title: 4, label: 5 } as const;

const stylesXml = (header: string, zebra: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">
<font><sz val="10"/><name val="Arial"/><family val="2"/></font>
<font><sz val="10"/><color rgb="FF1D2B22"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="15"/><color rgb="FF${header}"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FF${header}"/><name val="Arial"/><family val="2"/></font>
</fonts>
<fills count="6">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${zebra}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${header}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF${zebra}"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9E4DB"/></left><right style="thin"><color rgb="FFD9E4DB"/></right><top style="thin"><color rgb="FFD9E4DB"/></top><bottom style="thin"><color rgb="FFD9E4DB"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center" readingOrder="2"/></xf>
<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** يهرّب النص لـ XML ويحذف محارف التحكم التي تجعل الملف تالفاً في Excel. */
export function escapeXml(value: string) {
  return value
    // eslint-disable-next-line no-control-regex -- محارف التحكم هذه ممنوعة في XML فتُحذف عمداً.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A، و25 → Z، و26 → AA. */
export function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** اسم ورقة مقبول في Excel: بلا [ ] : * ? / \ وطوله 31 حرفاً على الأكثر، وغير مكرر. */
export function sanitizeSheetNames(names: string[]) {
  const used = new Set<string>();
  return names.map((raw, index) => {
    const base = raw.replace(/[[\]:*?/\\]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || `ورقة ${index + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    used.add(name.toLowerCase());
    return name;
  });
}

function cellStyle(layout: ArabicSheet["layout"], row: number, column: number) {
  if (row === 0) return layout === "summary" ? STYLE.title : STYLE.header;
  if (layout === "summary" && column === 0) return STYLE.label;
  return row % 2 === 0 ? STYLE.bodyEven : STYLE.bodyOdd;
}

function cellXml(value: XlsxCell, ref: string, style: number) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  const text = escapeXml(String(value));
  // النص المضمّن لا يُفسَّر أبداً كمعادلة، حتى لو بدأ بـ "=".
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

/** عرض العمود كما يكتبه Excel لعدد حروف معيّن (نفس صيغة الملفات السابقة، فلا يتغير شكل التقارير). */
function columnWidth(characters: number) {
  return characters + 0.83203125;
}

function sheetBounds(sheet: ArabicSheet) {
  const lastRow = Math.max(sheet.rows.length - 1, 0);
  const lastColumn = Math.max(0, sheet.widths.length - 1, ...sheet.rows.map((row) => row.length - 1));
  return { lastRow, lastColumn, ref: `A1:${columnName(lastColumn)}${lastRow + 1}` };
}

function hasFilter(sheet: ArabicSheet) {
  return sheet.layout === "table" && sheet.rows.length > 1;
}

function sheetXml(sheet: ArabicSheet) {
  const { ref } = sheetBounds(sheet);
  const cols = sheet.widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${columnWidth(width)}" customWidth="1"/>`)
    .join("");
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const height = rowIndex === 0 ? (sheet.layout === "summary" ? 30 : 28) : null;
      const cells = row.map((value, column) => cellXml(value, `${columnName(column)}${rowIndex + 1}`, cellStyle(sheet.layout, rowIndex, column))).join("");
      if (!cells && height === null) return "";
      return `<row r="${rowIndex + 1}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`
    + `<dimension ref="${ref}"/>`
    + (sheet.layout === "table" && sheet.rows.length > 1
      ? `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>`)
    + (cols ? `<cols>${cols}</cols>` : "")
    + `<sheetData>${rows}</sheetData>`
    + (hasFilter(sheet) ? `<autoFilter ref="${ref}"/>` : "")
    + `<pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.15" footer="0.15"/>`
    + `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>`
    + `</worksheet>`;
}

/** يبني ملف xlsx كاملاً من أوراق التقرير. */
export function buildArabicWorkbook(
  sheets: ArabicSheet[],
  colors: { header?: string; zebra?: string } = {}
): Uint8Array {
  const hex = (c: string | undefined, d: string) =>
    /^#?[0-9a-f]{6}$/i.test(c ?? "") ? c!.replace("#", "").toUpperCase() : d;
  if (!sheets.length) throw new Error("المصنف يحتاج ورقة واحدة على الأقل");
  const names = sanitizeSheetNames(sheets.map((sheet) => sheet.name));
  const absoluteRef = (ref: string) => ref.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2");
  const definedNames = sheets
    .map((sheet, index) => (hasFilter(sheet)
      ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${escapeXml(names[index].replace(/'/g, "''"))}'!${absoluteRef(sheetBounds(sheet).ref)}</definedName>`
      : ""))
    .join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Tarteel</Application></Properties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ""}</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(stylesXml(hex(colors.header, "0B4F39"), hex(colors.zebra, "F1F6F2"))),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet));
  });
  return zipSync(files, { level: 6 });
}
