/** تقارير PDF تحتاج pdfkit وخطوط Node؛ تُضاف إلى النسخة المحلية في المرحلة الثانية. Excel يعمل الآن. */
export interface ArabicPdfColumn {
  label: string;
  width: number;
  align?: "right" | "center" | "left";
}
export interface ArabicPdfSection {
  title: string;
  columns?: ArabicPdfColumn[];
  rows?: Array<Array<string | number | null | undefined>>;
  text?: string;
  emptyText?: string;
}
export interface ArabicPdfMetric {
  label: string;
  value: string | number;
}
export interface ArabicPdfReport {
  title: string;
  brandTitle?: string;
  subject?: string;
  details?: string[];
  metrics?: ArabicPdfMetric[];
  sections: ArabicPdfSection[];
  footerText?: string;
  [key: string]: unknown;
}

export function generateArabicReportPdf(
  _report: ArabicPdfReport
): Promise<never> {
  return Promise.reject(
    new Error(
      "تصدير PDF غير متاح بعد في نسخة الجهاز؛ استخدم تصدير Excel حالياً"
    )
  );
}
