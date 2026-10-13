/** موجّهات tRPC: لوحة التحكم والمنظمات والمراكز والفروع والمواسم. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { assertPermission } from "../accessControl";

import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import {
  createAcademicSeason,
  createBranch,
  createCenter,
  provisionIndependentCenter,
  createOrganization,
  getAcademicSeasons,
  getAcademicSeasonById,
  getBranchById,
  getBranches,
  getCenterById,
  getCenterManagerOverview,
  getDashboardStatsForCircles,
  getDashboardStatsForCenters,
  getOrganizationById,
  getRecentSessionsForCircles,
  getRecentSessionsForCenters,
  getUserCenterMemberships,
  softDeleteBranch,
  softDeleteCenter,
  updateAcademicSeason,
  updateBranch,
  updateCenter,
} from "../db";
import { getAccessibleCenterIds, getAccessibleDashboardCircleIds } from "./_shared";

export const centersRouters = {

  // ===================== DASHBOARD =====================
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      if (centerIds.length) return getDashboardStatsForCenters(centerIds);
      return getDashboardStatsForCircles(await getAccessibleDashboardCircleIds(ctx.user));
    }),
    recentSessions: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      if (centerIds.length) return getRecentSessionsForCenters(centerIds, 5);
      return getRecentSessionsForCircles(await getAccessibleDashboardCircleIds(ctx.user), 5);
    }),
    centerManager: protectedProcedure.input(z.object({ centerId: z.number() })).query(async ({ ctx, input }) => { await assertPermission(ctx.user, input.centerId, "center.view"); return getCenterManagerOverview(input.centerId); }),
  }),

  // ===================== ORGANIZATIONS =====================
  organizations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      const centersForUser = (await Promise.all(centerIds.map((id) => getCenterById(id)))).filter((center): center is NonNullable<typeof center> => Boolean(center));
      const organizationIds = Array.from(new Set(centersForUser.map((center) => center.organizationId)));
      const rows = await Promise.all(organizationIds.map((id) => getOrganizationById(id)));
      return rows.filter((organization): organization is NonNullable<typeof organization> => Boolean(organization));
    }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      const centersForUser = await Promise.all(centerIds.map((id) => getCenterById(id)));
      if (!centersForUser.some((center) => center?.organizationId === input.id)) throw new TRPCError({ code: "FORBIDDEN" });
      return getOrganizationById(input.id);
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(2),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!["super_admin", "admin", "org_admin"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء مؤسسة من صلاحية المدير العام" });
        return createOrganization(input);
      }),
  }),

  // ===================== CENTERS =====================
  centers: router({
    list: protectedProcedure.input(z.object({ orgId: z.number().optional() })).query(async ({ ctx, input }) => {
      const allowedIds = await getAccessibleCenterIds(ctx.user, "center.view");
      const rows = await Promise.all(allowedIds.map((id) => getCenterById(id)));
      return rows.filter((center): center is NonNullable<typeof center> => {
        if (!center) return false;
        return !input.orgId || center.organizationId === input.orgId;
      });
    }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => { await assertPermission(ctx.user, input.id, "center.view"); return getCenterById(input.id); }),
    create: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        name: z.string().min(2),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        address: z.string().optional(),
        city: z.string().optional(),
        managerId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!["super_admin", "admin", "org_admin", "center_manager"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء مركز جديد مخصص للمدير" });
        return createCenter({ ...input, managerId: input.managerId ?? ctx.user.id });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await assertPermission(ctx.user, id, "center.edit");
        await updateCenter(id, data);
      }),
    uploadLogo: protectedProcedure.input(z.object({ centerId: z.number(), filename: z.string().trim().min(1).max(120), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), base64: z.string().min(1).max(2_800_000) })).mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, input.centerId, "center.edit");
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length > 2_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن يكون حجم الشعار أقل من 2 ميغابايت" });
      const extension = input.contentType === "image/png" ? "png" : input.contentType === "image/jpeg" ? "jpg" : "webp";
      const uploaded = await storagePut(`centers/${input.centerId}/profile-logo.${extension}`, bytes, input.contentType);
      await updateCenter(input.centerId, { logoUrl: uploaded.url, logoKey: uploaded.key });
      return { logoUrl: uploaded.url };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const authorization = await assertPermission(ctx.user, input.id, "center.edit"); if (!authorization.membership.isOwner) throw new TRPCError({ code: "FORBIDDEN", message: "أرشفة المركز من صلاحية مالكه فقط" }); return softDeleteCenter(input.id); }),
  }),

  onboarding: router({
    createIndependentCenter: protectedProcedure.input(z.object({
      centerName: z.string().trim().min(2).max(255),
      organizationName: z.string().trim().min(2).max(255).optional(),
      phone: z.string().trim().max(32).optional(),
      email: z.string().trim().email().optional().or(z.literal("")),
      address: z.string().trim().max(2000).optional(),
      city: z.string().trim().max(100).optional(),
      description: z.string().trim().max(5000).optional(),
    })).mutation(async ({ ctx, input }) => {
      const memberships = await getUserCenterMemberships(ctx.user.id);
      const now = new Date();
      const isActivated = memberships.some((membership) => membership.status === "active" && !membership.revokedAt && (!membership.expiresAt || membership.expiresAt > now));
      if (isActivated) throw new TRPCError({ code: "CONFLICT", message: "حسابك مفعّل في مركز قائم، ويمكنك إدارة مراكزك من لوحة التحكم" });
      try {
        return await provisionIndependentCenter({ userId: ctx.user.id, ...input, email: input.email || undefined });
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذر إنشاء المركز المستقل";
        if (message === "الحساب مفعّل بالفعل في مركز قائم") throw new TRPCError({ code: "CONFLICT", message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
  }),

  // ===================== BRANCHES =====================
  branches: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ ctx, input }) => {
      if (input.centerId) { await assertPermission(ctx.user, input.centerId, "center.view"); return getBranches(input.centerId); }
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      return (await Promise.all(centerIds.map((centerId) => getBranches(centerId)))).flat();
    }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => { const branch = await getBranchById(input.id); if (!branch) return branch; await assertPermission(ctx.user, branch.centerId, "center.view"); return branch; }),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number(),
        name: z.string().min(2),
        description: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        supervisorId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, input.centerId, "center.edit"); return createBranch(input); }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const branch = await getBranchById(id); if (!branch) throw new TRPCError({ code: "NOT_FOUND" }); await assertPermission(ctx.user, branch.centerId, "center.edit");
        await updateBranch(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const branch = await getBranchById(input.id); if (!branch) throw new TRPCError({ code: "NOT_FOUND" }); await assertPermission(ctx.user, branch.centerId, "center.edit"); return softDeleteBranch(input.id); }),
  }),

  // ===================== ACADEMIC SEASONS =====================
  seasons: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ ctx, input }) => {
      if (input.centerId) { await assertPermission(ctx.user, input.centerId, "center.view"); return getAcademicSeasons(input.centerId); }
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      return (await Promise.all(centerIds.map((centerId) => getAcademicSeasons(centerId)))).flat();
    }),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number(),
        name: z.string().min(2),
        type: z.enum(["academic_year", "semester", "summer", "ramadan", "custom"]),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, input.centerId, "center.edit"); return createAcademicSeason(input); }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const season = await getAcademicSeasonById(id); if (!season) throw new TRPCError({ code: "NOT_FOUND" }); await assertPermission(ctx.user, season.centerId, "center.edit");
        await updateAcademicSeason(id, data);
      }),
  }),
};
