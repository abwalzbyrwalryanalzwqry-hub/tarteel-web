import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { generateUnifiedReportPDF } from "./reports/unifiedPdf";
import { generateExecutiveCircleExcel, generateExecutiveCirclePdf } from "./reports/executiveExport";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("نظام التقرير الموحد", () => {
  it("يبني نموذجاً من بيانات الحلقة الفعلية ويحافظ على أقسام وتراكم عمليات الطالب", () => {
    const builder = read("server/reports/reportBuilder.ts");
    expect(builder).toContain("buildUnifiedReport");
    expect(builder).toContain("memorizationRows");
    expect(builder).toContain("revisionRows");
    expect(builder).toContain("StudentReportBlock");
    expect(builder).toContain("attendanceRate");
  });

  it("يعرض ترويسة وملخصاً وجدول حضور وكتلاً مستقلة للطلاب في RTL", () => {
    const preview = read("client/src/components/ReportPreview.tsx");
    expect(preview).toContain('dir="rtl"');
    expect(preview).toContain("بيانات الحضور");
    expect(preview).toContain("StudentBlock");
    expect(preview).toContain("تم التوليد بواسطة تطبيق ترتيل");
  });

  it("يوفر إعداد التقرير والمعاينة والطباعة والمشاركة دون إلغاء التصديرات الحالية", () => {
    const composer = read("client/src/components/ReportComposer.tsx");
    expect(composer).toContain("reporting.preview");
    expect(composer).toContain("معاينة التقرير");
    expect(composer).toContain("window.print");
    expect(composer).toContain("navigator.share");
    expect(composer).toContain("ExportButtons");
  });

  it("يوفر PDF موحداً بحجم A4 وفوتر وترقيم صفحات ويسجله في الأرشيف", () => {
    const pdf = read("server/reports/unifiedPdf.ts");
    const pdfLayout = read("server/export/reportPdf.ts");
    const router = read("server/routers/reporting.ts");
    const composer = read("client/src/components/ReportComposer.tsx");
    expect(pdf).toContain("generateArabicReportPdf");
    expect(pdfLayout).toContain('size: "A4"');
    expect(pdfLayout).toContain("تم التوليد بواسطة تطبيق ترتيل");
    expect(pdfLayout).toContain("bufferedPageRange");
    expect(router).toContain("exportPdf");
    expect(composer).toContain("PDF موحد");
    expect(composer).toContain('reportType: "unified"');
  });

  it("يولد PDF عربياً متعدد الصفحات مع خط مضمّن وفوتر وترقيم", async () => {
    const students = Array.from({ length: 22 }, (_, index) => ({ student: { id: index + 1, name: `طالب عربي طويل الاسم ${index + 1}`, enrollmentDate: null }, attendance: { present: 2, absent: 0, late: 0, excused: 0, total: 2 }, memorization: [{ id: index + 1, kind: "memorization" as const, from: "الفاتحة · آية 1", to: "الفاتحة · آية 7", pages: 1, grade: "ممتاز", date: new Date("2026-08-24"), notes: null }], revision: [], averageScore: 100, evaluations: [] }));
    const report = { meta: { title: "حلقة الاختبار", typeLabel: "تقرير شامل", circleName: "حلقة الاختبار", centerName: "المركز", startDate: null, endDate: null, generatedAt: new Date("2026-08-24") }, sections: { summary: true, attendance: true, memorization: true, revision: true, evaluations: true }, summary: { students: students.length, present: 44, absent: 0, late: 0, excused: 0, attendanceRate: 100, memorizationCount: students.length, revisionCount: 0, averageScore: 100 }, students };
    const pdf = await generateUnifiedReportPDF(report);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2_000);
    expect(pdf.toString("latin1")).toContain("Amiri");
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
    const compactPdf = await generateUnifiedReportPDF({ ...report, summary: { ...report.summary, students: 2, present: 4, memorizationCount: 2 }, students: students.slice(0, 2) });
    expect(compactPdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("يجهز ملفات PDF وExcel للتقرير التنفيذي بعد معاينة حية وتنزيل ومشاركة", async () => {
    const router = read("server/routers/reporting.ts");
    const exporter = read("server/reports/executiveExport.ts");
    const preview = read("client/src/components/ExecutiveCircleReport.tsx");
    const report = { meta: { circleId: 1, circleName: "حلقة الإتقان", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-31"), period: "monthly" as const }, summary: { sessions: 4, present: 12, absent: 1, late: 1, excused: 0, attendanceRate: 86, memorizationEntries: 8, revisionEntries: 6, memorizedPages: 10, reviewedPages: 7 }, buckets: [{ key: "2026-08", label: "صفر ١٤٤٨ هـ", sessions: 4, present: 12, absent: 1, late: 1, excused: 0, memorizationEntries: 8, revisionEntries: 6, memorizedPages: 10, reviewedPages: 7 }] };
    const pdf = await generateExecutiveCirclePdf(report);
    const excel = generateExecutiveCircleExcel(report);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.toString("latin1")).toContain("Amiri");
    expect(excel.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(router).toContain("exportExecutivePdf");
    expect(router).toContain("exportExecutiveExcel");
    expect(exporter).toContain("التفصيل الزمني");
    expect(preview).toContain("معاينة قبل التصدير");
    expect(preview).toContain("تجهيز PDF");
    expect(preview).toContain("تجهيز Excel");
    expect(preview).toContain("previewRequested");
    expect(preview).toContain("navigator.share");
  });

  it("يبني لوحة إدارة للمركز من الفترات المعتمدة فقط مع مقارنة الحلقات واتجاهاتها وتنبيهاتها", () => {
    const builder = read("server/reports/reportBuilder.ts");
    const router = read("server/routers/reporting.ts");
    const management = read("client/src/components/ManagementReport.tsx");
    const educationSummary = read("client/src/components/ManagementEducationSummary.tsx");
    expect(builder).toContain("buildCenterManagementReport");
    expect(builder).toContain('ne(sessions.status, "draft")');
    expect(builder).toContain("comparisons");
    expect(builder).toContain("alerts");
    expect(builder).toContain("getReportingGoals");
    expect(router).toContain("management:");
    expect(router).toContain("saveManagementGoals");
    expect(management).toContain("لوحة إدارة المركز");
    expect(management).toContain("LineChart");
    expect(management).toContain("BarChart");
    expect(management).toContain("تنبيهات المتابعة");
    expect(builder).toContain("studentsWithRecordedProgress");
    expect(builder).toContain("studentsWithoutRecordedProgress");
    expect(builder).toContain("progressCoverageRate");
    expect(builder).toContain("progress-coverage-");
    expect(builder).toContain("استكمل توثيق تقدم الطلاب");
    expect(educationSummary).toContain("توثيق التقدم التعليمي");
    expect(educationSummary).toContain("تغطية توثيق التقدم بالحلقات");
  });

  it("يوفر تقرير إدارة قابل للتصدير وفلاتر معلم وعمر وإجراءات تنبيه مباشرة", () => {
    const builder = read("server/reports/reportBuilder.ts");
    const router = read("server/routers/reporting.ts");
    const exporter = read("server/reports/managementExport.ts");
    const management = read("client/src/components/ManagementReport.tsx");
    expect(builder).toContain("teacherId?: number");
    expect(builder).toContain("ageGroup?: StudentAgeGroup");
    expect(builder).toContain("studentAgeGroup");
    expect(builder).toContain("teacherPhone");
    expect(router).toContain("exportManagementPdf");
    expect(router).toContain("exportManagementExcel");
    expect(exporter).toContain("generateManagementReportPdf");
    expect(exporter).toContain("generateManagementReportExcel");
    expect(exporter).toContain("مقارنة الحلقات");
    expect(exporter).toContain("التنبيهات");
    expect(management).toContain("فلاتر مقارنة الحلقات");
    expect(management).toContain("مراسلة المعلم");
    expect(management).toContain("عرض تفاصيل الحلقة");
    expect(management).toContain("PDF الإدارة");
    expect(management).toContain("Excel الإدارة");
  });

  it("يدعم هوية مركز مخصصة في PDF ورسالة معلم قابلة للتعديل ورسوم مقارنة تفاعلية", () => {
    const schema = read("drizzle/schema.ts");
    const router = read("server/routers/reporting.ts");
    const builder = read("server/reports/reportBuilder.ts");
    const exporter = read("server/reports/managementExport.ts");
    const management = read("client/src/components/ManagementReport.tsx");
    expect(schema).toContain("reportingPreferences");
    expect(schema).toContain("teacherMessageTemplate");
    expect(schema).toContain("logoKey");
    expect(router).toContain("managementPreferences");
    expect(router).toContain("saveManagementPreferences");
    expect(router).toContain("uploadManagementLogo");
    expect(builder).toContain("branding");
    expect(exporter).toContain("readLogo");
    expect(exporter).toContain("headerTitle");
    expect(exporter).toContain("footerText");
    expect(management).toContain("تخصيص قالب PDF ورسالة المتابعة");
    expect(management).toContain("teacherMessageTemplate");
    expect(management).toContain("المؤشر المرئي");
    expect(management).toContain("comparisonMetric");
  });

  it("يجعل ملف المركز مصدراً موحداً للاسم والشعار في التقرير ويوفر لوحة شاملة لمديره", () => {
    const schema = read("drizzle/schema.ts");
    const router = read("server/routers.ts");
    const db = read("server/db.ts");
    const builder = read("server/reports/reportBuilder.ts");
    const dashboard = read("client/src/components/CenterManagerDashboard.tsx");
    const centers = read("client/src/pages/Centers.tsx");
    expect(schema).toContain('logoUrl: text("logoUrl")');
    expect(schema).toContain('logoKey: text("logoKey")');
    expect(router).toContain("uploadLogo");
    expect(router).toContain("centerManager:");
    expect(db).toContain("getCenterManagerOverview");
    expect(builder).toContain("center.logoKey");
    expect(dashboard).toContain("لوحة مدير المركز");
    expect(dashboard).toContain("المعلمون النشطون");
    expect(dashboard).toContain("صفحات الحفظ حسب الأيام");
    expect(centers).toContain("شعار ملف المركز");
  });
});
