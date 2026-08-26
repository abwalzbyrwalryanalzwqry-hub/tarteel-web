import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { assertCirclePermission, assertPermission, type AccessSubject } from "../accessControl";
import { buildCenterManagementReport, buildExecutiveCircleReport, buildUnifiedReport } from "../reports/reportBuilder";
import { saveReportingGoals } from "../db";
import { generateExecutiveCircleExcel, generateExecutiveCirclePdf } from "../reports/executiveExport";
import { generateUnifiedReportPDF } from "../reports/unifiedPdf";

const reportInput = z.object({
  circleId: z.number(), startDate: z.date().optional(), endDate: z.date().optional(), studentIds: z.array(z.number()).optional(),
  reportType: z.enum(["circle", "student", "attendance", "progress", "comprehensive"]), sortBy: z.enum(["alphabetical", "enrollment", "performance", "attendance"]),
  sections: z.object({ summary: z.boolean(), attendance: z.boolean(), memorization: z.boolean(), revision: z.boolean(), evaluations: z.boolean() }),
});
const executiveInput = z.object({ circleId: z.number(), period: z.enum(["weekly", "monthly"]), startDate: z.date().optional(), endDate: z.date().optional() });
const managementInput = z.object({ centerId: z.number(), period: z.enum(["weekly", "monthly"]), startDate: z.date().optional(), endDate: z.date().optional() });

async function assertReportScope(user: AccessSubject, circleId: number, permission: "reports.view" | "reports.export" = "reports.view") {
  await assertCirclePermission(user, circleId, permission);
}

export const reportingRouter = router({
  preview: protectedProcedure.input(reportInput).query(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); return buildUnifiedReport(input); }),
  exportPdf: protectedProcedure.input(reportInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId, "reports.export"); const report = await buildUnifiedReport(input); const buffer = await generateUnifiedReportPDF(report); return { data: buffer.toString("base64"), filename: `تقرير_${report.meta.circleName}_${Date.now()}.pdf`, contentType: "application/pdf" }; }),
  executive: protectedProcedure.input(executiveInput).query(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); return buildExecutiveCircleReport(input); }),
  management: protectedProcedure.input(managementInput).query(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "reports.view"); return buildCenterManagementReport(input); }),
  saveManagementGoals: protectedProcedure.input(z.object({ centerId: z.number(), attendanceTarget: z.number().int().min(0).max(100).nullable(), memorizedPagesTarget: z.number().int().min(0).max(100000).nullable(), reviewedPagesTarget: z.number().int().min(0).max(100000).nullable() })).mutation(async ({ input, ctx }) => { await assertPermission(ctx.user, input.centerId, "center.edit"); return saveReportingGoals({ ...input, updatedBy: ctx.user.id }); }),
  exportExecutivePdf: protectedProcedure.input(executiveInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId, "reports.export"); const report = await buildExecutiveCircleReport(input); const buffer = await generateExecutiveCirclePdf(report); return { data: buffer.toString("base64"), filename: `تقرير_تنفيذي_${report.meta.circleName}_${Date.now()}.pdf`, contentType: "application/pdf" }; }),
  exportExecutiveExcel: protectedProcedure.input(executiveInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId, "reports.export"); const report = await buildExecutiveCircleReport(input); const buffer = generateExecutiveCircleExcel(report); return { data: buffer.toString("base64"), filename: `تقرير_تنفيذي_${report.meta.circleName}_${Date.now()}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }; }),
});
