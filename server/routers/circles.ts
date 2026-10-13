/** موجّهات tRPC: الحلقات وفتراتها. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { assertCirclePermission, assertPermission } from "../accessControl";

import { protectedProcedure, router } from "../_core/trpc";

import {
  createCircle,
  createCirclePeriod,
  getBranchById,
  getCircleById,
  getCirclePeriodById,
  getCirclePeriods,
  getCircles,
  softDeleteCircle,
  softDeleteCirclePeriod,
  updateCircle,
  updateCirclePeriod,
} from "../db";
import { assertTeacherCircleAccess, createDailyPeriod, filterAccessibleCircles, getTeacherCircleScope } from "./_shared";

export const circlesRouters = {

  // ===================== CIRCLES =====================
  circles: router({
    list: protectedProcedure.input(z.object({ branchId: z.number().optional(), seasonId: z.number().optional() })).query(async ({ ctx, input }) => {
      const scope = await getTeacherCircleScope(ctx.user);
      if (!scope) return filterAccessibleCircles(ctx.user, await getCircles(input.branchId, input.seasonId));
      const scopedCircles = (await Promise.all(scope.map((id) => getCircleById(id)))).filter((circle): circle is NonNullable<typeof circle> => Boolean(circle));
      return scopedCircles.filter((circle) => (!input.branchId || circle.branchId === input.branchId) && (!input.seasonId || circle.seasonId === input.seasonId));
    }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => { const circle = await getCircleById(input.id); await assertTeacherCircleAccess(ctx.user, circle?.id); return circle; }),
    create: protectedProcedure
      .input(z.object({
        branchId: z.number(),
        seasonId: z.number(),
        name: z.string().min(2),
        description: z.string().optional(),
        teacherId: z.number().optional(),
        assistantTeacherId: z.number().optional(),
        maxStudents: z.number().optional(),
        schedule: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => { const branch = await getBranchById(input.branchId); if (!branch) throw new TRPCError({ code: "NOT_FOUND" }); await assertPermission(ctx.user, branch.centerId, "circles.create"); return createCircle(input); }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        teacherId: z.number().optional(),
        maxStudents: z.number().optional(),
        schedule: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const circle = await getCircleById(id);
        if (!circle) throw new TRPCError({ code: "NOT_FOUND" }); await assertCirclePermission(ctx.user, circle.id, "circles.edit");
        await updateCircle(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await assertCirclePermission(ctx.user, input.id, "circles.delete"); return softDeleteCircle(input.id); }),
  }),

  // ===================== CIRCLE PERIODS =====================
  circlePeriods: router({
    list: protectedProcedure.input(z.object({ circleId: z.number() })).query(async ({ ctx, input }) => {
      await assertTeacherCircleAccess(ctx.user, input.circleId);
      return getCirclePeriods(input.circleId);
    }),
    create: protectedProcedure.input(z.object({ circleId: z.number(), name: z.string().min(2), sessionType: z.string().min(2).max(64), daysOfWeek: z.string().min(1).max(128), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/).optional() })).mutation(async ({ ctx, input }) => {
      await assertTeacherCircleAccess(ctx.user, input.circleId);
      return createCirclePeriod({ ...input, createdBy: ctx.user.id });
    }),
    update: protectedProcedure.input(z.object({ id: z.number(), name: z.string().min(2).optional(), sessionType: z.string().min(2).max(64).optional(), daysOfWeek: z.string().min(1).max(128).optional(), startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const period = await getCirclePeriodById(input.id);
      if (!period) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTeacherCircleAccess(ctx.user, period.circleId);
      const { id, ...data } = input;
      return updateCirclePeriod(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const period = await getCirclePeriodById(input.id);
      if (!period) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTeacherCircleAccess(ctx.user, period.circleId);
      return softDeleteCirclePeriod(input.id);
    }),
    createSession: protectedProcedure.input(z.object({ periodId: z.number(), scheduledAt: z.date() })).mutation(async ({ ctx, input }) => {
      const period = await getCirclePeriodById(input.periodId);
      if (!period) throw new TRPCError({ code: "NOT_FOUND", message: "الفترة غير موجودة" });
      await assertTeacherCircleAccess(ctx.user, period.circleId);
      const circle = await getCircleById(period.circleId);
      if (!circle?.teacherId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم تعيين معلم للحَلَقة قبل إنشاء جلسة" });
      return createDailyPeriod(ctx.user, { circleId: circle.id, teacherId: circle.teacherId, seasonId: circle.seasonId, title: `${period.name} · ${period.sessionType}`, type: "regular", scheduledAt: input.scheduledAt });
    }),
  }),
};
