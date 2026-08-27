import XLSX from "xlsx-js-style";
import { configureArabicWorkbook, styleArabicSummary, styleArabicTable, writeArabicWorkbook } from "./arabicExcel";

interface MemorizationRow { studentName: string; surahName: string; versesCount: number; quality: string; date: string; notes: string; }
interface AttendanceRow { studentName: string; sessionDate: string; status: string; sessionType: string; circle: string; }

function createSheet(headers: string[], rows: Array<Array<string | number>>) { return XLSX.utils.aoa_to_sheet([headers, ...rows]); }

export function generateMemorizationExcel(data: MemorizationRow[], centerName: string, circleName: string): Buffer {
  const workbook = XLSX.utils.book_new(); configureArabicWorkbook(workbook);
  const info = XLSX.utils.aoa_to_sheet([["تقرير الحفظ"], ["المركز", centerName], ["الحلقة", circleName], ["تاريخ التقرير", new Date().toLocaleDateString("ar-SA")], ["إجمالي السجلات", data.length]]);
  const details = createSheet(["اسم الطالب", "السورة والنطاق", "عدد الآيات", "التقدير", "التاريخ", "الملاحظات"], data.map((row) => [row.studentName, row.surahName, row.versesCount, row.quality, row.date, row.notes]));
  styleArabicSummary(info, [24, 34]); styleArabicTable(details, { headerRow: 1, widths: [25, 37, 14, 16, 17, 36] });
  XLSX.utils.book_append_sheet(workbook, info, "ملخص الحفظ"); XLSX.utils.book_append_sheet(workbook, details, "سجلات الحفظ");
  return writeArabicWorkbook(workbook);
}

export function generateAttendanceExcel(data: AttendanceRow[], centerName: string, startDate: string, endDate: string): Buffer {
  const workbook = XLSX.utils.book_new(); configureArabicWorkbook(workbook);
  const count = (status: string) => data.filter((row) => row.status === status).length;
  const summary = XLSX.utils.aoa_to_sheet([["تقرير الحضور والغياب"], ["المركز", centerName], ["من تاريخ", startDate], ["إلى تاريخ", endDate], [], ["المؤشر", "القيمة"], ["حاضر", count("حاضر")], ["غائب", count("غائب")], ["متأخر", count("متأخر")], ["معذور", count("معذور")], ["إجمالي السجلات", data.length]]);
  const details = createSheet(["اسم الطالب", "تاريخ الجلسة", "الحالة", "نوع الجلسة", "الحلقة"], data.map((row) => [row.studentName, row.sessionDate, row.status, row.sessionType, row.circle]));
  styleArabicSummary(summary, [24, 30]); styleArabicTable(details, { headerRow: 1, widths: [28, 20, 17, 22, 25] });
  XLSX.utils.book_append_sheet(workbook, summary, "ملخص الحضور"); XLSX.utils.book_append_sheet(workbook, details, "تفصيل الحضور");
  return writeArabicWorkbook(workbook);
}

export function generateStudentsReportExcel(students: Array<{ name: string; email?: string; phone?: string; guardianName?: string; enrollmentDate: string; status: string }>, centerName: string): Buffer {
  const workbook = XLSX.utils.book_new(); configureArabicWorkbook(workbook);
  const summary = XLSX.utils.aoa_to_sheet([["تقرير الطلاب"], ["المركز", centerName], ["تاريخ التقرير", new Date().toLocaleDateString("ar-SA")], ["إجمالي الطلاب", students.length]]);
  const details = createSheet(["اسم الطالب", "البريد الإلكتروني", "الهاتف", "ولي الأمر", "تاريخ التسجيل", "الحالة"], students.map((student) => [student.name, student.email ?? "غير متاح", student.phone ?? "غير متاح", student.guardianName ?? "غير متاح", student.enrollmentDate, student.status]));
  styleArabicSummary(summary, [24, 34]); styleArabicTable(details, { headerRow: 1, widths: [26, 32, 20, 26, 20, 16] });
  XLSX.utils.book_append_sheet(workbook, summary, "ملخص الطلاب"); XLSX.utils.book_append_sheet(workbook, details, "قائمة الطلاب");
  return writeArabicWorkbook(workbook);
}
