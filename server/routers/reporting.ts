import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { assertCirclePermission, type AccessSubject } from "../accessControl";
import { buildExecutiveCircleReport, buildUnifiedReport } from "../reports/reportBuilder";
import { generateUnifiedReportPDF } from "../reports/unifiedPdf";

const reportInput = z.object({
  circleId: z.number(), startDate: z.date().optional(), endDate: z.date().optional(), studentIds: z.array(z.number()).optional(),
  reportType: z.enum(["circle", "student", "attendance", "progress", "comprehensive"]), sortBy: z.enum(["alphabetical", "enrollment", "performance", "attendance"]),
  sections: z.object({ summary: z.boolean(), attendance: z.boolean(), memorization: z.boolean(), revision: z.boolean(), evaluations: z.boolean() }),
});

async function assertReportScope(user: AccessSubject, circleId: number, permission: "reports.view" | "reports.export" = "reports.view") {
  await assertCirclePermission(user, circleId, permission);
}

export const reportingRouter = router({
  preview: protectedProcedure.input(reportInput).query(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); return buildUnifiedReport(input); }),
  exportPdf: protectedProcedure.input(reportInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId, "reports.export"); const report = await buildUnifiedReport(input); const buffer = await generateUnifiedReportPDF(report); return { data: buffer.toString("base64"), filename: `تقرير_${report.meta.circleName}_${Date.now()}.pdf`, contentType: "application/pdf" }; }),
  executive: protectedProcedure.input(z.object({ circleId: z.number(), period: z.enum(["weekly", "monthly"]), startDate: z.date().optional(), endDate: z.date().optional() })).query(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); return buildExecutiveCircleReport(input); }),
});
