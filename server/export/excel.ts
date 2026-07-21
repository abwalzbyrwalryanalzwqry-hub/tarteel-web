import * as XLSX from 'xlsx';

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

/**
 * توليد ملف Excel لتقرير الحفظ
 */
export function generateMemorizationExcel(
  data: MemorizationRow[],
  centerName: string,
  circleName: string
): Buffer {
  // إنشاء workbook جديد
  const workbook = XLSX.utils.book_new();

  // تحويل البيانات إلى ورقة عمل
  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: ['studentName', 'surahName', 'versesCount', 'quality', 'date', 'notes'],
  });

  // تعيين عناوين الأعمدة بالعربية
  worksheet['A1'] = { v: 'اسم الطالب', t: 's' };
  worksheet['B1'] = { v: 'السورة', t: 's' };
  worksheet['C1'] = { v: 'عدد الآيات', t: 's' };
  worksheet['D1'] = { v: 'الجودة', t: 's' };
  worksheet['E1'] = { v: 'التاريخ', t: 's' };
  worksheet['F1'] = { v: 'الملاحظات', t: 's' };

  // تعيين عرض الأعمدة
  worksheet['!cols'] = [
    { wch: 20 }, // اسم الطالب
    { wch: 15 }, // السورة
    { wch: 12 }, // عدد الآيات
    { wch: 12 }, // الجودة
    { wch: 15 }, // التاريخ
    { wch: 25 }, // الملاحظات
  ];

  // إضافة ورقة عمل للمعلومات الأساسية
  const infoWorksheet = XLSX.utils.aoa_to_sheet([
    ['تقرير الحفظ'],
    ['المركز', centerName],
    ['الحلقة', circleName],
    ['تاريخ التقرير', new Date().toLocaleDateString('ar-SA')],
    ['إجمالي السجلات', data.length],
  ]);

  infoWorksheet['!cols'] = [{ wch: 20 }, { wch: 30 }];

  // إضافة الأوراق إلى الـ workbook
  XLSX.utils.book_append_sheet(workbook, infoWorksheet, 'المعلومات');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الحفظ');

  // تحويل إلى buffer
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

/**
 * توليد ملف Excel لتقرير الحضور والغياب
 */
export function generateAttendanceExcel(
  data: AttendanceRow[],
  centerName: string,
  startDate: string,
  endDate: string
): Buffer {
  const workbook = XLSX.utils.book_new();

  // تحويل البيانات إلى ورقة عمل
  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: ['studentName', 'sessionDate', 'status', 'sessionType', 'circle'],
  });

  // تعيين عناوين الأعمدة بالعربية
  worksheet['A1'] = { v: 'اسم الطالب', t: 's' };
  worksheet['B1'] = { v: 'تاريخ الجلسة', t: 's' };
  worksheet['C1'] = { v: 'الحالة', t: 's' };
  worksheet['D1'] = { v: 'نوع الجلسة', t: 's' };
  worksheet['E1'] = { v: 'الحلقة', t: 's' };

  // تعيين عرض الأعمدة
  worksheet['!cols'] = [
    { wch: 20 }, // اسم الطالب
    { wch: 15 }, // تاريخ الجلسة
    { wch: 12 }, // الحالة
    { wch: 12 }, // نوع الجلسة
    { wch: 15 }, // الحلقة
  ];

  // إضافة ورقة عمل للإحصائيات
  const presentCount = data.filter((d) => d.status === 'حاضر').length;
  const absentCount = data.filter((d) => d.status === 'غائب').length;
  const lateCount = data.filter((d) => d.status === 'متأخر').length;
  const excusedCount = data.filter((d) => d.status === 'معذور').length;

  const statsWorksheet = XLSX.utils.aoa_to_sheet([
    ['تقرير الحضور والغياب'],
    ['المركز', centerName],
    ['من تاريخ', startDate],
    ['إلى تاريخ', endDate],
    [''],
    ['الإحصائيات'],
    ['حاضر', presentCount],
    ['غائب', absentCount],
    ['متأخر', lateCount],
    ['معذور', excusedCount],
    ['الإجمالي', data.length],
  ]);

  statsWorksheet['!cols'] = [{ wch: 20 }, { wch: 15 }];

  // إضافة الأوراق إلى الـ workbook
  XLSX.utils.book_append_sheet(workbook, statsWorksheet, 'الإحصائيات');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'التفاصيل');

  // تحويل إلى buffer
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

/**
 * توليد ملف Excel لتقرير الطلاب بتفاصيل شاملة
 */
export function generateStudentsReportExcel(
  students: Array<{
    name: string;
    email?: string;
    phone?: string;
    enrollmentDate: string;
    status: string;
  }>,
  centerName: string
): Buffer {
  const workbook = XLSX.utils.book_new();

  const worksheet = XLSX.utils.json_to_sheet(students, {
    header: ['name', 'email', 'phone', 'enrollmentDate', 'status'],
  });

  // تعيين عناوين الأعمدة بالعربية
  worksheet['A1'] = { v: 'الاسم', t: 's' };
  worksheet['B1'] = { v: 'البريد الإلكتروني', t: 's' };
  worksheet['C1'] = { v: 'الهاتف', t: 's' };
  worksheet['D1'] = { v: 'تاريخ التسجيل', t: 's' };
  worksheet['E1'] = { v: 'الحالة', t: 's' };

  worksheet['!cols'] = [
    { wch: 20 }, // الاسم
    { wch: 25 }, // البريد الإلكتروني
    { wch: 15 }, // الهاتف
    { wch: 15 }, // تاريخ التسجيل
    { wch: 12 }, // الحالة
  ];

  const infoWorksheet = XLSX.utils.aoa_to_sheet([
    ['تقرير الطلاب'],
    ['المركز', centerName],
    ['تاريخ التقرير', new Date().toLocaleDateString('ar-SA')],
    ['إجمالي الطلاب', students.length],
  ]);

  infoWorksheet['!cols'] = [{ wch: 20 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(workbook, infoWorksheet, 'المعلومات');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلاب');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}
