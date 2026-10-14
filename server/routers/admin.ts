/** موجّهات tRPC: الإشعارات وسجل التدقيق والمحذوفات والمستخدمون. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { assertCirclePermission, assertPermission } from "../accessControl";

import { protectedProcedure, router } from "../_core/trpc";

import {
  createNotification,
  getAuditLogForCenter,
  getCenterMembers,
  getNotificationsByUser,
  getTrashedItemsForCircles,
  getTrashedItemsForCenters,
  getTrashedItemCenterId,
  getTrashedSessionCircleId,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  permanentlyDeleteTrashedSession,
  restoreItem,
} from "../db";
import { getAccessibleCenterIds, getTeacherCircleScope } from "./_shared";

export const adminRouters = {

  // ===================== NOTIFICATIONS =====================
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => getNotificationsByUser(ctx.user.id)),
    unreadCount: protectedProcedure.query(async ({ ctx }) => getUnreadNotificationsCount(ctx.user.id)),
    // كل إشعار يخص صاحبه: لا يعلّم المستخدم إشعار غيره مقروءاً (المعرّفات متسلسلة ويمكن تخمينها).
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!(await markNotificationRead(input.id, ctx.user.id))) throw new TRPCError({ code: "NOT_FOUND", message: "الإشعار غير موجود" });
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => markAllNotificationsRead(ctx.user.id)),
    /**
     * إشعار تجريبي من «الإعدادات» لصاحب الحساب فقط. إشعارات المستخدمين الآخرين تُنشأ داخل الخادم
     * مع العمليات نفسها (استرداد كود، ربط ولي أمر…)، لا من الواجهة، حتى لا يرسل أحد إشعاراً مزيفاً لغيره.
     */
    create: protectedProcedure
      .input(z.object({
        /** للتوافق مع الواجهات القديمة: إن أُرسل يجب أن يكون معرّف المستخدم نفسه. */
        userId: z.number().int().positive().optional(),
        title: z.string().trim().min(1).max(255),
        message: z.string().trim().min(1).max(2000),
        type: z.enum(["info", "warning", "success", "error"]).default("info"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId !== undefined && input.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن إرسال إشعار إلى مستخدم آخر" });
        await createNotification({ userId: ctx.user.id, title: input.title, message: input.message, type: input.type });
      }),
  }),

  // ===================== AUDIT LOG =====================
  auditLog: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      if (input?.centerId) { await assertPermission(ctx.user, input.centerId, "audit_logs.view"); return getAuditLogForCenter(input.centerId, 50); }
      const centerIds = await getAccessibleCenterIds(ctx.user, "audit_logs.view");
      return (await Promise.all(centerIds.map((centerId) => getAuditLogForCenter(centerId, 50)))).flat().sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 50);
    }),
  }),

  // ===================== TRASH =====================
  trash: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const circleScope = await getTeacherCircleScope(ctx.user);
      if (circleScope) return getTrashedItemsForCircles(circleScope);
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.edit");
      return getTrashedItemsForCenters(centerIds);
    }),
    restore: protectedProcedure
      .input(z.object({ table: z.enum(["centers", "teachers", "students", "circles", "sessions"]), id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.table === "sessions") {
          const circleId = await getTrashedSessionCircleId(input.id);
          if (!circleId) throw new TRPCError({ code: "NOT_FOUND" });
          await assertCirclePermission(ctx.user, circleId, "attendance.edit");
          return restoreItem(input.table, input.id);
        }
        const centerId = await getTrashedItemCenterId(input.table, input.id);
        if (!centerId) throw new TRPCError({ code: "NOT_FOUND" });
        await assertPermission(ctx.user, centerId, "center.edit");
        return restoreItem(input.table, input.id);
      }),
    permanentlyDeleteSession: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const circleId = await getTrashedSessionCircleId(input.id);
      if (!circleId) throw new TRPCError({ code: "NOT_FOUND", message: "الفترة غير موجودة في سلة المهملات" });
      await assertCirclePermission(ctx.user, circleId, "attendance.edit");
      const deleted = await permanentlyDeleteTrashedSession(input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "الفترة غير موجودة في سلة المهملات" });
      return { success: true } as const;
    }),
  }),

  // ===================== USERS =====================
  users: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "users.view");
      const rows = (await Promise.all(centerIds.map((centerId) => getCenterMembers(centerId)))).flat();
      return Array.from(new Map(rows.map(({ user }) => [user.id, user])).values());
    }),
  }),
};
