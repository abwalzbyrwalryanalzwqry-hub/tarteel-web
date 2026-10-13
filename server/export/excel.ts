import { buildArabicWorkbook } from "./arabicExcel";

interface MemorizationRow { studentName: string; surahName: string; versesCount: number; quality: string; date: string; notes: string; }
interface AttendanceRow { studentName: string; sessionDate: string; status: string; sessionType: string; circle: string; }

export function generateMemorizationExcel(data: MemorizationRow[], centerName: string, circleName: string): Buffer {
  return buildArabicWorkbook([
    { name: "ملخص الحفظ", layout: "summary", widths: [24, 34], rows: [["تقرير الحفظ"], ["المركز", centerName], ["الحلقة", circleName], ["تاريخ التقرير", new Date().toLocaleDateString("ar-SA")], ["إجمالي السجلات", data.length]] },
    { name: "سجلات الحفظ", layout: "table", widths: [25, 37, 14, 16, 17, 36], rows: [["اسم الطالب", "السورة والنطاق", "عدد الآيات", "التقدير", "التاريخ", "الملاحظات"], ...data.map((row) => [row.studentName, row.surahName, row.versesCount, row.quality, row.date, row.notes])] },
  ]);
}

export function generateAttendanceExcel(data: AttendanceRow[], centerName: string, startDate: string, endDate: string): Buffer {
  const count = (status: string) => data.filter((row) => row.status === status).length;
  return buildArabicWorkbook([
    { name: "ملخص الحضور", layout: "summary", widths: [24, 30], rows: [["تقرير الحضور والغياب"], ["المركز", centerName], ["من تاريخ", startDate], ["إلى تاريخ", endDate], [], ["المؤشر", "القيمة"], ["حاضر", count("حاضر")], ["غائب", count("غائب")], ["متأخر", count("متأخر")], ["معذور", count("معذور")], ["إجمالي السجلات", data.length]] },
    { name: "تفصيل الحضور", layout: "table", widths: [28, 20, 17, 22, 25], rows: [["اسم الطالب", "تاريخ الجلسة", "الحالة", "نوع الجلسة", "الحلقة"], ...data.map((row) => [row.studentName, row.sessionDate, row.status, row.sessionType, row.circle])] },
  ]);
}

export function generateStudentsReportExcel(students: Array<{ name: string; email?: string; phone?: string; guardianName?: string; enrollmentDate: string; status: string }>, centerName: string): Buffer {
  return buildArabicWorkbook([
    { name: "ملخص الطلاب", layout: "summary", widths: [24, 34], rows: [["تقرير الطلاب"], ["المركز", centerName], ["تاريخ التقرير", new Date().toLocaleDateString("ar-SA")], ["إجمالي الطلاب", students.length]] },
    { name: "قائمة الطلاب", layout: "table", widths: [26, 32, 20, 26, 20, 16], rows: [["اسم الطالب", "البريد الإلكتروني", "الهاتف", "ولي الأمر", "تاريخ التسجيل", "الحالة"], ...students.map((student) => [student.name, student.email ?? "غير متاح", student.phone ?? "غير متاح", student.guardianName ?? "غير متاح", student.enrollmentDate, student.status])] },
  ]);
}
