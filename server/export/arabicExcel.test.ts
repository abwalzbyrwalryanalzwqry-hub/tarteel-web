import XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { configureArabicWorkbook, styleArabicTable, writeArabicWorkbook } from "./arabicExcel";

describe("تنسيق Excel العربي", () => {
  it("يضبط اتجاه المصنف إلى RTL قبل إضافة أوراق التقرير", () => {
    const workbook = XLSX.utils.book_new();
    configureArabicWorkbook(workbook);
    expect(workbook.Workbook?.Views).toEqual([{ RTL: true }]);
  });

  it("يضع عنوان الجدول بخلفية الهوية ومحاذاة قراءة عربية مع حدود", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["اسم الطالب", "الحالة"], ["طالب", "حاضر"]]);
    styleArabicTable(sheet, { headerRow: 1, widths: [26, 18] });
    expect(sheet["A1"]?.s?.alignment?.readingOrder).toBe(2);
    expect(sheet["A1"]?.s?.fill?.fgColor?.rgb).toBe("0B4F39");
    expect(sheet["A2"]?.s?.border).toBeTruthy();
  });

  it("يكتب ملف xlsx صالحاً بإعداد طباعة أفقي A4 لكل ورقة، ويحافظ على البيانات العربية وRTL", () => {
    const workbook = XLSX.utils.book_new();
    configureArabicWorkbook(workbook);
    const sheet = XLSX.utils.aoa_to_sheet([["اسم الطالب", "الحالة"], ["عبدالله", "حاضر"]]);
    styleArabicTable(sheet, { headerRow: 1, widths: [26, 18] });
    XLSX.utils.book_append_sheet(workbook, sheet, "الحضور");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["ملخص"]]), "ملخص");
    const buffer = writeArabicWorkbook(workbook);

    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    const files = unzipSync(new Uint8Array(buffer));
    const sheets = Object.keys(files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    expect(sheets).toHaveLength(2);
    for (const name of sheets) {
      const xml = strFromU8(files[name]);
      expect(xml).toContain('<pageSetUpPr fitToPage="1"/>');
      expect(xml).toMatch(/<pageSetup orientation="landscape" paperSize="9"[^>]*\/><\/worksheet>$/);
    }

    const reopened = XLSX.read(buffer, { type: "buffer" });
    expect(reopened.SheetNames).toEqual(["الحضور", "ملخص"]);
    expect(reopened.Sheets["الحضور"]["A2"].v).toBe("عبدالله");
    expect(reopened.Workbook?.Views?.[0]?.RTL).toBe(true);
  });
});
