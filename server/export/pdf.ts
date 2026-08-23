import PDFDocument from 'pdfkit';

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

/**
 * توليد ملف PDF لتقرير الحفظ
 */
export function generateMemorizationPDF(
  data: MemorizationRow[],
  centerName: string,
  circleName: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // العنوان
    doc.fontSize(20).font('Helvetica-Bold').text('تقرير الحفظ', { align: 'right' });
    doc.moveDown(0.5);

    // المعلومات الأساسية
    doc.fontSize(11).font('Helvetica');
    doc.text(`المركز: ${centerName}`, { align: 'right' });
    doc.text(`الحلقة: ${circleName}`, { align: 'right' });
    doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, { align: 'right' });
    doc.text(`إجمالي السجلات: ${data.length}`, { align: 'right' });
    doc.moveDown(1);

    // رسم الجدول
    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 150;
    const col3X = 230;
    const col4X = 290;
    const col5X = 350;
    const col6X = 450;
    const rowHeight = 25;

    // رأس الجدول
    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(col1X, tableTop, col2X - col1X, rowHeight).stroke();
    doc.text('اسم الطالب', col1X + 5, tableTop + 5, { width: col2X - col1X - 10, align: 'right' });

    doc.rect(col2X, tableTop, col3X - col2X, rowHeight).stroke();
    doc.text('السورة', col2X + 5, tableTop + 5, { width: col3X - col2X - 10, align: 'right' });

    doc.rect(col3X, tableTop, col4X - col3X, rowHeight).stroke();
    doc.text('الآيات', col3X + 5, tableTop + 5, { width: col4X - col3X - 10, align: 'center' });

    doc.rect(col4X, tableTop, col5X - col4X, rowHeight).stroke();
    doc.text('الجودة', col4X + 5, tableTop + 5, { width: col5X - col4X - 10, align: 'center' });

    doc.rect(col5X, tableTop, col6X - col5X, rowHeight).stroke();
    doc.text('التاريخ', col5X + 5, tableTop + 5, { width: col6X - col5X - 10, align: 'center' });

    // البيانات
    doc.fontSize(9).font('Helvetica');
    let currentY = tableTop + rowHeight;

    data.forEach((row) => {
      if (currentY > doc.page.height - 50) {
        doc.addPage();
        currentY = 40;
      }

      doc.rect(col1X, currentY, col2X - col1X, rowHeight).stroke();
      doc.text(row.studentName, col1X + 5, currentY + 5, {
        width: col2X - col1X - 10,
        align: 'right',
      });

      doc.rect(col2X, currentY, col3X - col2X, rowHeight).stroke();
      doc.text(row.surahName, col2X + 5, currentY + 5, {
        width: col3X - col2X - 10,
        align: 'right',
      });

      doc.rect(col3X, currentY, col4X - col3X, rowHeight).stroke();
      doc.text(row.versesCount.toString(), col3X + 5, currentY + 5, {
        width: col4X - col3X - 10,
        align: 'center',
      });

      doc.rect(col4X, currentY, col5X - col4X, rowHeight).stroke();
      doc.text(row.quality, col4X + 5, currentY + 5, {
        width: col5X - col4X - 10,
        align: 'center',
      });

      doc.rect(col5X, currentY, col6X - col5X, rowHeight).stroke();
      doc.text(row.date, col5X + 5, currentY + 5, {
        width: col6X - col5X - 10,
        align: 'center',
      });

      currentY += rowHeight;
    });

    doc.end();
  });
}

/**
 * توليد ملف PDF لتقرير الحضور والغياب
 */
export function generateAttendancePDF(
  data: AttendanceRow[],
  centerName: string,
  startDate: string,
  endDate: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // العنوان
    doc.fontSize(20).font('Helvetica-Bold').text('تقرير الحضور والغياب', { align: 'right' });
    doc.moveDown(0.5);

    // المعلومات الأساسية
    doc.fontSize(11).font('Helvetica');
    doc.text(`المركز: ${centerName}`, { align: 'right' });
    doc.text(`من تاريخ: ${startDate}`, { align: 'right' });
    doc.text(`إلى تاريخ: ${endDate}`, { align: 'right' });
    doc.moveDown(0.5);

    // الإحصائيات
    const presentCount = data.filter((d) => d.status === 'حاضر').length;
    const absentCount = data.filter((d) => d.status === 'غائب').length;
    const lateCount = data.filter((d) => d.status === 'متأخر').length;
    const excusedCount = data.filter((d) => d.status === 'معذور').length;

    doc.fontSize(10).font('Helvetica-Bold').text('الإحصائيات:', { align: 'right' });
    doc.fontSize(10).font('Helvetica');
    doc.text(`حاضر: ${presentCount}`, { align: 'right' });
    doc.text(`غائب: ${absentCount}`, { align: 'right' });
    doc.text(`متأخر: ${lateCount}`, { align: 'right' });
    doc.text(`معذور: ${excusedCount}`, { align: 'right' });
    doc.moveDown(1);

    // رسم الجدول
    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 180;
    const col3X = 280;
    const col4X = 360;
    const col5X = 450;
    const rowHeight = 25;

    // رأس الجدول
    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(col1X, tableTop, col2X - col1X, rowHeight).stroke();
    doc.text('اسم الطالب', col1X + 5, tableTop + 5, { width: col2X - col1X - 10, align: 'right' });

    doc.rect(col2X, tableTop, col3X - col2X, rowHeight).stroke();
    doc.text('التاريخ', col2X + 5, tableTop + 5, { width: col3X - col2X - 10, align: 'center' });

    doc.rect(col3X, tableTop, col4X - col3X, rowHeight).stroke();
    doc.text('الحالة', col3X + 5, tableTop + 5, { width: col4X - col3X - 10, align: 'center' });

    doc.rect(col4X, tableTop, col5X - col4X, rowHeight).stroke();
    doc.text('النوع', col4X + 5, tableTop + 5, { width: col5X - col4X - 10, align: 'center' });

    // البيانات
    doc.fontSize(9).font('Helvetica');
    let currentY = tableTop + rowHeight;

    data.forEach((row) => {
      if (currentY > doc.page.height - 50) {
        doc.addPage();
        currentY = 40;
      }

      doc.rect(col1X, currentY, col2X - col1X, rowHeight).stroke();
      doc.text(row.studentName, col1X + 5, currentY + 5, {
        width: col2X - col1X - 10,
        align: 'right',
      });

      doc.rect(col2X, currentY, col3X - col2X, rowHeight).stroke();
      doc.text(row.sessionDate, col2X + 5, currentY + 5, {
        width: col3X - col2X - 10,
        align: 'center',
      });

      doc.rect(col3X, currentY, col4X - col3X, rowHeight).stroke();
      doc.text(row.status, col3X + 5, currentY + 5, {
        width: col4X - col3X - 10,
        align: 'center',
      });

      doc.rect(col4X, currentY, col5X - col4X, rowHeight).stroke();
      doc.text(row.sessionType, col4X + 5, currentY + 5, {
        width: col5X - col4X - 10,
        align: 'center',
      });

      currentY += rowHeight;
    });

    doc.end();
  });
}

/** توليد ملف PDF مخصص لتقرير الطلاب، بدلاً من إعادة استخدام قالب الحضور. */
export function generateStudentsReportPDF(
  data: StudentReportRow[],
  centerName: string,
  circleName: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text('تقرير الطلاب', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`المركز: ${centerName}`, { align: 'right' });
    doc.text(`الحلقة: ${circleName}`, { align: 'right' });
    doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, { align: 'right' });
    doc.text(`إجمالي الطلاب: ${data.length}`, { align: 'right' });
    doc.moveDown(1);

    const columns = [50, 170, 275, 390, 470];
    const rowHeight = 25;
    const drawHeader = (y: number) => {
      const labels = ['اسم الطالب', 'الهاتف', 'ولي الأمر', 'التسجيل', 'الحالة'];
      doc.fontSize(9).font('Helvetica-Bold');
      labels.forEach((label, index) => {
        const x = columns[index];
        const width = (columns[index + 1] ?? 545) - x;
        doc.rect(x, y, width, rowHeight).stroke();
        doc.text(label, x + 4, y + 6, { width: width - 8, align: 'center' });
      });
    };

    let currentY = doc.y;
    drawHeader(currentY);
    currentY += rowHeight;
    doc.fontSize(8).font('Helvetica');

    for (const row of data) {
      if (currentY > doc.page.height - 55) {
        doc.addPage();
        currentY = 40;
        drawHeader(currentY);
        currentY += rowHeight;
        doc.fontSize(8).font('Helvetica');
      }
      const values = [row.name, row.phone || '—', row.guardianName || '—', row.enrollmentDate, row.status];
      values.forEach((value, index) => {
        const x = columns[index];
        const width = (columns[index + 1] ?? 545) - x;
        doc.rect(x, currentY, width, rowHeight).stroke();
        doc.text(value, x + 4, currentY + 7, { width: width - 8, align: 'center' });
      });
      currentY += rowHeight;
    }
    doc.end();
  });
}
