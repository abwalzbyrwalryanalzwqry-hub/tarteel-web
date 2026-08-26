import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { assertCirclePermission, assertPermission, type AccessSubject } from "../accessControl";
import { buildCenterManagementReport, buildExecutiveCircleReport, buildUnifiedReport } from "../reports/reportBuilder";
import { getReportingPreferences, saveReportingGoals, saveReportingPreferences } from "../db";
import { storagePut } from "../storage";
import { generateExecutiveCircleExcel, generateExecutiveCirclePdf } from "../reports/executiveExport";
import { generateManagementReportExcel, generateManagementReportPdf } from "../reports/managementExport";
import { generateUnifiedReportPDF } from "../reports/unifiedPdf";

const reportInput = z.object({
  circleId: z.number(), startDate: z.date().optional(), endDate: z.date().optional(), studentIds: z.array(z.number()).optional(),
  reportType: z.enum(["circle", "student", "attendance", "progress", "comprehensive"]), sortBy: z.enum(["alphabetical", "enrollment", "performance", "attendance"]),
  sections: z.object({ summary: z.boolean(), attendance: z.boolean(), memorization: z.boolean(), revision: z.boolean(), evaluations: z.boolean() }),
});
const executiveInput = z.object({ circleId: z.number(), period: z.enum(["weekly", "monthly"]), startDate: z.date().optional(), endDate: z.date().optional() });
const managementInput = z.object({ centerId: z.number(), period: z.enum(["weekly", "monthly"]), startDate: z.date().optional(), endDate: z.date().optional(), teacherId: z.number().optional(), ageGroup: z.enum(["under_10", "10_13", "14_17", "18_plus"]).optional() });

async function assertReportScope(user: AccessSubject, circleId: number, permission: "reports.view" | "reports.export" = "reports.view") {
  await assertCirclePermission(user, circleId, permission);
}

export const reportingRouter = router({
  preview: protectedProcedure.input(reportInput).query(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); return buildUnifiedReport(input); }),
  exportPdf: protectedProcedure.input(reportInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId, "reports.export"); const report = await buildUnifiedReport(input); const buffer = await generateUnifiedReportPDF(report); return { data: buffer.toString("base64"), filename: `تقرير_${report.meta.circleName}_${Date.now()}.pdf`, contentType: "application/pdf" }; }),
  executive: protectedProcedure.input(executiveInput).query(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); return buildExecutiveCircleReport(input); }),
  management: protectedProcedure.input(managementInput).query(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "reports.view"); return buildCenterManagementReport(input); }),
  managementPreferences: protectedProcedure.input(z.object({ centerId: z.number() })).query(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "reports.view"); return getReportingPreferences(input.centerId); }),
  saveManagementPreferences: protectedProcedure.input(z.object({ centerId: z.number(), headerTitle: z.string().trim().max(255).nullable(), footerText: z.string().trim().max(500).nullable(), teacherMessageTemplate: z.string().trim().max(2000).nullable(), logoUrl: z.string().trim().max(2000).nullable() })).mutation(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "center.edit"); const existing = await getReportingPreferences(input.centerId); return saveReportingPreferences({ centerId: input.centerId, headerTitle: input.headerTitle, footerText: input.footerText, teacherMessageTemplate: input.teacherMessageTemplate, logoUrl: input.logoUrl, logoKey: existing?.logoKey ?? null, updatedBy: ctx.user.id }); }),
  uploadManagementLogo: protectedProcedure.input(z.object({ centerId: z.number(), filename: z.string().trim().min(1).max(120), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), base64: z.string().min(1).max(2_800_000) })).mutation(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "center.edit"); const bytes = Buffer.from(input.base64, "base64"); if (!bytes.length || bytes.length > 2_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن يكون حجم الشعار أقل من 2 ميغابايت" }); const extension = input.contentType === "image/png" ? "png" : input.contentType === "image/jpeg" ? "jpg" : "webp"; const uploaded = await storagePut(`reporting/center-${input.centerId}/logo.${extension}`, bytes, input.contentType); const existing = await getReportingPreferences(input.centerId); const preferences = await saveReportingPreferences({ centerId: input.centerId, headerTitle: existing?.headerTitle ?? null, footerText: existing?.footerText ?? null, teacherMessageTemplate: existing?.teacherMessageTemplate ?? null, logoUrl: uploaded.url, logoKey: uploaded.key, updatedBy: ctx.user.id }); return { logoUrl: uploaded.url, preferences }; }),
  exportManagementPdf: protectedProcedure.input(managementInput).mutation(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "reports.export"); const report = await buildCenterManagementReport(input); const buffer = await generateManagementReportPdf(report); return { data: buffer.toString("base64"), filename: `تقرير_إدارة_${report.meta.centerName}_${Date.now()}.pdf`, contentType: "application/pdf" }; }),
  exportManagementExcel: protectedProcedure.input(managementInput).mutation(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "reports.export"); const report = await buildCenterManagementReport(input); const buffer = generateManagementReportExcel(report); return { data: buffer.toString("base64"), filename: `تقرير_إدارة_${report.meta.centerName}_${Date.now()}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }; }),
  saveManagementGoals: protectedProcedure.input(z.object({ centerId: z.number(), attendanceTarget: z.number().int().min(0).max(100).nullable(), memorizedPagesTarget: z.number().int().min(0).max(100000).nullable(), reviewedPagesTarget: z.number().int().min(0).max(100000).nullable() })).mutation(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "center.edit"); return saveReportingGoals({ ...input, updatedBy: ctx.user.id }); }),
  exportExecutivePdf: protectedProcedure.input(executiveInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId, "reports.export"); const report = await buildExecutiveCircleReport(input); const buffer = await generateExecutiveCirclePdf(report); return { data: buffer.toString("base64"), filename: `تقرير_تنفيذي_${report.meta.circleName}_${Date.now()}.pdf`, contentType: "application/pdf" }; }),
  exportExecutiveExcel: protectedProcedure.input(executiveInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId, "reports.export"); const report = await buildExecutiveCircleReport(input); const buffer = generateExecutiveCircleExcel(report); return { data: buffer.toString("base64"), filename: `تقرير_تنفيذي_${report.meta.circleName}_${Date.now()}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }; }),
});
