/** موجّهات tRPC: الحلقات وفتراتها. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { assertCirclePermission, assertPermission } from "../accessControl";

import { protectedProcedure, router } from "../_core/trpc";

import {
  createCircle,
  getCircleById,
  getCircles,
  softDeleteCircle,
  updateCircle,
} from "../db";
import { assertTeacherCircleAccess, filterAccessibleCircles, getAccessibleCenterIds, getTeacherCircleScope } from "./_shared";

export const circlesRouters = {

  // ===================== CIRCLES =====================
  circles: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const centerId = input?.centerId;
      const scope = await getTeacherCircleScope(ctx.user);
      if (!scope) return filterAccessibleCircles(ctx.user, await getCircles(centerId));
      const scopedCircles = (await Promise.all(scope.map((id) => getCircleById(id)))).filter((circle): circle is NonNullable<typeof circle> => Boolean(circle));
      return scopedCircles.filter((circle) => !centerId || circle.centerId === centerId);
    }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => { const circle = await getCircleById(input.id); await assertTeacherCircleAccess(ctx.user, circle?.id); return circle; }),
    create: protectedProcedure
      .input(z.object({
        /** اختياري: إن كان للمستخدم مركز واحد يُستخدم تلقائياً. */
        centerId: z.number().optional(),
        name: z.string().min(2),
        description: z.string().optional(),
        teacherId: z.number().optional(),
        assistantTeacherId: z.number().optional(),
        maxStudents: z.number().optional(),
        schedule: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let centerId = input.centerId;
        if (!centerId) {
          const centerIds = await getAccessibleCenterIds(ctx.user, "circles.create");
          if (centerIds.length !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: centerIds.length ? "اختر المركز الذي تتبع له الحلقة" : "لا يوجد مركز يمكنك إنشاء حلقة فيه" });
          centerId = centerIds[0];
        }
        await assertPermission(ctx.user, centerId, "circles.create");
        return createCircle({ ...input, centerId });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        teacherId: z.number().optional(),
        description: z.string().optional(),
        assistantTeacherId: z.number().nullable().optional(),
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

};
