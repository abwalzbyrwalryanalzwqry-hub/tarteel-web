import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildArabicWorkbook, columnName, escapeXml, sanitizeSheetNames, type ArabicSheet } from "./arabicExcel";
import { generateAttendanceExcel, generateMemorizationExcel, generateStudentsReportExcel } from "./excel";

const unzip = (buffer: Buffer) => {
  const files = unzipSync(new Uint8Array(buffer));
  return (name: string) => strFromU8(files[name]);
};

const sample: ArabicSheet[] = [
  { name: "الملخص", layout: "summary", widths: [24, 30], rows: [["تقرير الحضور"], ["المركز", "مركز النور"], [], ["المؤشر", "القيمة"], ["حاضر", 12]] },
  { name: "الحضور", layout: "table", widths: [26, 18], rows: [["اسم الطالب", "الحالة"], ["عبدالله", "حاضر"], ["سارة", "غائب"]] },
];

describe("مولّد Excel العربي", () => {
  it("ينتج حزمة xlsx فيها كل الأجزاء المطلوبة، وورقة لكل جدول", () => {
    const buffer = buildArabicWorkbook(sample);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    const files = Object.keys(unzipSync(new Uint8Array(buffer)));
    expect(files).toEqual(expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]));
    const read = unzip(buffer);
    expect(read("xl/workbook.xml")).toContain('<sheet name="الملخص" sheetId="1" r:id="rId1"/>');
    expect(read("xl/workbook.xml")).toContain('<sheet name="الحضور" sheetId="2" r:id="rId2"/>');
  });

  it("كل ورقة من اليمين لليسار، وطباعتها أفقية على A4 بملاءمة العرض", () => {
    const read = unzip(buildArabicWorkbook(sample));
    for (const name of ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
      const xml = read(name);
      expect(xml).toContain('<sheetView rightToLeft="1"');
      expect(xml).toContain('<pageSetUpPr fitToPage="1"/>');
      expect(xml).toMatch(/<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"\/><\/worksheet>$/);
    }
  });

  it("رأس الجدول بلون الهوية، والعنوان والتسميات في الملخص، والفلتر في جداول التفصيل فقط", () => {
    const read = unzip(buildArabicWorkbook(sample));
    const styles = read("xl/styles.xml");
    expect(styles).toContain('<fgColor rgb="FF0B4F39"/>');
    expect(styles).toContain('readingOrder="2"');
    const summary = read("xl/worksheets/sheet1.xml");
    const table = read("xl/worksheets/sheet2.xml");
    expect(summary).toContain('<c r="A1" s="4" t="inlineStr">'); // عنوان
    expect(summary).toContain('<c r="A2" s="5" t="inlineStr">'); // تسمية
    expect(summary).toContain('<c r="B5" s="1"><v>12</v></c>'); // رقم يبقى رقماً
    expect(summary).not.toContain("<autoFilter");
    expect(table).toContain('<c r="A1" s="3" t="inlineStr">'); // رأس الجدول
    expect(table).toContain('<autoFilter ref="A1:B3"/>');
    expect(read("xl/workbook.xml")).toContain(`<definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">'الحضور'!$A$1:$B$3</definedName>`);
  });

  it("يهرّب الرموز الخاصة ويحذف محارف التحكم، والنص الذي يبدأ بـ = لا يصبح معادلة", () => {
    expect(escapeXml(`<a & "b">`)).toBe("&lt;a &amp; &quot;b&quot;&gt;");
    expect(escapeXml("سطر\u0000\u0007 نظيف")).toBe("سطر نظيف");
    const read = unzip(buildArabicWorkbook([{ name: "x", layout: "table", widths: [10], rows: [["رأس"], ["=HYPERLINK(\"http://evil\")"]] }]));
    const xml = read("xl/worksheets/sheet1.xml");
    expect(xml).not.toContain("<f>");
    expect(xml).toContain("=HYPERLINK(&quot;http://evil&quot;)");
  });

  it("أسماء الأعمدة وأسماء الأوراق صحيحة ومقبولة في Excel", () => {
    expect([0, 25, 26, 51, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AZ", "ZZ", "AAA"]);
    const names = sanitizeSheetNames(["تقرير: [شهري]/2026", "تقرير: [شهري]/2026", "", "ا".repeat(40)]);
    expect(names[0]).not.toMatch(/[[\]:*?/\\]/);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(4);
    expect(names.every((n) => n.length > 0 && n.length <= 31)).toBe(true);
  });

  it("الصفوف الفارغة والقيم الناقصة لا تنتج خلايا", () => {
    const xml = unzip(buildArabicWorkbook([{ name: "x", layout: "summary", widths: [10, 10], rows: [["عنوان"], [], ["أ", null], ["ب", undefined]] }]))("xl/worksheets/sheet1.xml");
    expect(xml).not.toContain('<row r="2"');
    expect(xml).not.toContain('r="B3"');
    expect(xml).not.toContain('r="B4"');
  });

  it("يرفض مصنفاً بلا أوراق", () => {
    expect(() => buildArabicWorkbook([])).toThrow();
  });

  it("تقارير الحفظ والحضور والطلاب تنتج ملفات بأوراقها وبياناتها العربية", () => {
    const memorization = unzip(generateMemorizationExcel([{ studentName: "عبدالله", surahName: "البقرة 1-5", versesCount: 5, quality: "ممتاز", date: "2026-10-01", notes: "" }], "مركز النور", "حلقة الفجر"));
    expect(memorization("xl/workbook.xml")).toContain("سجلات الحفظ");
    expect(memorization("xl/worksheets/sheet2.xml")).toContain("عبدالله");
    expect(memorization("xl/worksheets/sheet2.xml")).toContain('<v>5</v>');

    const attendance = unzip(generateAttendanceExcel([{ studentName: "سارة", sessionDate: "2026-10-01", status: "حاضر", sessionType: "حفظ", circle: "الفجر" }], "مركز النور", "2026-10-01", "2026-10-31"));
    expect(attendance("xl/worksheets/sheet1.xml")).toContain("تقرير الحضور والغياب");

    const students = unzip(generateStudentsReportExcel([{ name: "محمد", enrollmentDate: "2026-09-01", status: "نشط" }], "مركز النور"));
    expect(students("xl/worksheets/sheet2.xml")).toContain("غير متاح");
  });
});
