import { generateArabicReportPdf } from "./reportPdf";

interface MemorizationRow {
  studentName: string;
  surahName: string;
  versesCount: number;
  quality: string;
  date: string;
  notes: string;
}

interface AttendanceRow {
  studentName: string;
  sessionDate: string;
  status: string;
  sessionType: string;
  circle: string;
}

interface StudentReportRow {
  name: string;
  phone?: string;
  guardianName?: string;
  enrollmentDate: string;
  status: string;
}

const reportDate = () => new Date().toLocaleDateString("ar-SA");

export function generateMemorizationPDF(data: MemorizationRow[], centerName: string, circleName: string): Promise<Buffer> {
  return generateArabicReportPdf({
    brandTitle: centerName,
    title: "تقرير الحفظ",
    subject: `الحلقة: ${circleName}`,
    details: [`تاريخ التقرير: ${reportDate()}`, `إجمالي سجلات الحفظ: ${data.length}`],
    metrics: [{ label: "سجلات الحفظ", value: data.length }, { label: "عدد الطلاب", value: new Set(data.map((row) => row.studentName)).size }],
    sections: [{ title: "تفصيل سجلات الحفظ", columns: [{ label: "اسم الطالب", width: 145 }, { label: "السورة والنطاق", width: 135 }, { label: "الآيات", width: 48, align: "center" }, { label: "التقدير", width: 58, align: "center" }, { label: "التاريخ", width: 68, align: "center" }, { label: "ملاحظات", width: 58 }], rows: data.map((row) => [row.studentName, row.surahName, row.versesCount, row.quality, row.date, row.notes]), emptyText: "لا توجد سجلات حفظ ضمن النطاق المحدد." }],
  });
}

export function generateAttendancePDF(data: AttendanceRow[], centerName: string, startDate: string, endDate: string): Promise<Buffer> {
  const count = (status: string) => data.filter((row) => row.status === status).length;
  return generateArabicReportPdf({
    brandTitle: centerName,
    title: "تقرير الحضور والغياب",
    subject: `الفترة: ${startDate} — ${endDate}`,
    details: [`تاريخ التقرير: ${reportDate()}`, `إجمالي السجلات: ${data.length}`],
    metrics: [{ label: "حاضر", value: count("حاضر") }, { label: "غائب", value: count("غائب") }, { label: "متأخر", value: count("متأخر") }, { label: "معذور", value: count("معذور") }],
    sections: [{ title: "تفصيل الحضور والغياب", columns: [{ label: "اسم الطالب", width: 158 }, { label: "تاريخ الجلسة", width: 87, align: "center" }, { label: "الحالة", width: 74, align: "center" }, { label: "نوع الجلسة", width: 94, align: "center" }, { label: "الحلقة", width: 98 }], rows: data.map((row) => [row.studentName, row.sessionDate, row.status, row.sessionType, row.circle]), emptyText: "لا توجد سجلات حضور وغياب ضمن النطاق المحدد." }],
  });
}

export function generateStudentsReportPDF(data: StudentReportRow[], centerName: string, circleName: string): Promise<Buffer> {
  return generateArabicReportPdf({
    brandTitle: centerName,
    title: "تقرير الطلاب",
    subject: `الحلقة: ${circleName}`,
    details: [`تاريخ التقرير: ${reportDate()}`, `إجمالي الطلاب: ${data.length}`],
    metrics: [{ label: "إجمالي الطلاب", value: data.length }, { label: "الطلاب النشطون", value: data.filter((row) => row.status === "نشط").length }],
    sections: [{ title: "قائمة الطلاب", columns: [{ label: "اسم الطالب", width: 150 }, { label: "الهاتف", width: 90, align: "center" }, { label: "ولي الأمر", width: 110 }, { label: "تاريخ التسجيل", width: 90, align: "center" }, { label: "الحالة", width: 71, align: "center" }], rows: data.map((row) => [row.name, row.phone, row.guardianName, row.enrollmentDate, row.status]), emptyText: "لا يوجد طلاب في هذه الحلقة." }],
  });
}
