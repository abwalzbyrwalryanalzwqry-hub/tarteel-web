import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getCircleIdsForTeacher, getTeacherByUserId } from "../db";
import { buildUnifiedReport } from "../reports/reportBuilder";
import { generateUnifiedReportPDF } from "../reports/unifiedPdf";

const reportInput = z.object({
  circleId: z.number(), startDate: z.date().optional(), endDate: z.date().optional(), studentIds: z.array(z.number()).optional(),
  reportType: z.enum(["circle", "student", "attendance", "progress", "comprehensive"]), sortBy: z.enum(["alphabetical", "enrollment", "performance", "attendance"]),
  sections: z.object({ summary: z.boolean(), attendance: z.boolean(), memorization: z.boolean(), revision: z.boolean(), evaluations: z.boolean() }),
});

async function assertReportScope(user: { id: number; role: string }, circleId: number) {
  if (!["teacher", "assistant_teacher"].includes(user.role)) return;
  const teacher = await getTeacherByUserId(user.id);
  const scope = teacher ? await getCircleIdsForTeacher(teacher.id) : [];
  if (!scope.includes(circleId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن إنشاء تقرير خارج نطاق حَلَقتك" });
}

export const reportingRouter = router({
  preview: protectedProcedure.input(reportInput).query(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); return buildUnifiedReport(input); }),
  exportPdf: protectedProcedure.input(reportInput).mutation(async ({ input, ctx }) => { await assertReportScope(ctx.user, input.circleId); const report = await buildUnifiedReport(input); const buffer = await generateUnifiedReportPDF(report); return { data: buffer.toString("base64"), filename: `تقرير_${report.meta.circleName}_${Date.now()}.pdf`, contentType: "application/pdf" }; }),
});
