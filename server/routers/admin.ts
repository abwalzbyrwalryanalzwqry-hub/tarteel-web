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
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => markNotificationRead(input.id)),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => markAllNotificationsRead(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        userId: z.number(),
        title: z.string(),
        message: z.string(),
        type: z.enum(["info", "warning", "success", "error", "attendance", "session", "memorization"]).default("info"),
      }))
      .mutation(async ({ input }) => createNotification(input)),
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
      .input(z.object({ table: z.enum(["centers", "branches", "teachers", "students", "circles", "sessions"]), id: z.number() }))
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
