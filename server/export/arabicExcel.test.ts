import XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";
import { configureArabicWorkbook, styleArabicTable } from "./arabicExcel";

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
});
