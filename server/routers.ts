import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { GRANULAR_PERMISSIONS, hasTarteelPermission } from "../shared/permissions";
import { assertCanDelegate, assertCirclePermission, assertPermission, assertScope, assertStudentPermission, getAuthorization, ROLE_PERMISSION_TEMPLATES, type AccessSubject } from "./accessControl";
import { getQuranRangeError } from "../shared/mizan";
import { createAccessCodeSecret, getAccessCodeHint, hashAccessCode } from "./accessCodeSecurity";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { exportRouter } from "./routers/export";
import { aiRouter } from "./routers/ai";
import { reportingRouter } from "./routers/reporting";
import {
  createAcademicSeason,
  createAccessCode,
  createAuditLog,
  createCenterMembership,
  createPermissionGrants,
  createUserScopes,
  createBranch,
  createCenter,
  createCircle,
  createCirclePeriod,
  createMemorization,
  createNotification,
  createOrganization,
  createRevision,
  createSession,
  createStudent,
  createTeacher,
  createTeacherInvite,
  redeemTeacherInvite,
  getAcademicSeasons,
  getAcademicSeasonById,
  getAllUsers,
  getAttendanceBySession,
  getAuditLog,
  getAuditLogForCenter,
  getBranchById,
  getBranches,
  getCenterById,
  getCenterMemberById,
  getCenterMembers,
  getCenterIdForCircle,
  getCenterIdForStudent,
  getCenters,
  getCircleById,
  getCircleIdsForTeacher,
  getCirclePeriodById,
  getCirclePeriods,
  getCircleMonthlyRecord,
  getCircles,
  getDashboardStats,
  getDashboardStatsForCenters,
  getEvaluationBySession,
  getMemorizationBySession,
  getMemorizationByStudent,
  getNotificationsByUser,
  getOrganizationById,
  getParentStudentLinks,
  getOrganizations,
  getRecentSessions,
  getRecentSessionsForCenters,
  getRevisionBySession,
  getSessionById,
  getSessions,
  getStudentById,
  getStudentMizanProfile,
  getStudentByUserId,
  getStudentsByGuardianUserId,
  getStudents,
  getTeacherById,
  getTeacherByUserId,
  getTeacherInviteById,
  getTeacherInvites,
  getTeacherLastActivity,
  getUserCenterMemberships,
  getTeachers,
  getTrashedItems,
  getTrashedItemsForCenters,
  getTrashedItemCenterId,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  restoreItem,
  revokeTeacherInvite,
  revokeAccessCode,
  revokeUserPermissionGrants,
  revokeUserScopes,
  softDeleteBranch,
  softDeleteCenter,
  softDeleteCircle,
  softDeleteCirclePeriod,
  softDeleteSession,
  softDeleteStudent,
  softDeleteTeacher,
  transferTeacherToCircle,
  updateAcademicSeason,
  updateBranch,
  updateCenter,
  updateCircle,
  updateCirclePeriod,
  updateSession,
  updateStudent,
  updateTeacher,
  updateCenterMembership,
  upsertAttendance,
  upsertEvaluation,
  getAccessCodeByHash,
  getAccessCodeById,
  getAccessCodesForCenter,
  redeemAccessCodeSecure,
} from "./db";

const TEACHING_ROLES = new Set(["teacher", "assistant_teacher"]);

async function getTeacherCircleScope(user: AccessSubject) {
  if (!TEACHING_ROLES.has(user.role)) return null;
  const teacher = await getTeacherByUserId(user.id);
  if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "لا يوجد ملف معلم مرتبط بحسابك" });
  return getCircleIdsForTeacher(teacher.id);
}

async function assertTeacherCircleAccess(user: AccessSubject, circleId: number | null | undefined) {
  if (!circleId) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تحديد نطاق الحلقة" });
  await assertCirclePermission(user, circleId, "circles.view");
}

async function getAuthorizedSession(user: AccessSubject, sessionId: number) {
  const session = await getSessionById(sessionId);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة" });
  await assertCirclePermission(user, session.circleId, "attendance.view");
  return session;
}

async function assertSessionStudentMatch(user: AccessSubject, sessionId: number, studentId: number) {
  const [session, student] = await Promise.all([getAuthorizedSession(user, sessionId), getStudentById(studentId)]);
  if (!student || student.circleId !== session.circleId) throw new TRPCError({ code: "BAD_REQUEST", message: "الطالب لا ينتمي إلى حَلَقَة هذه الجلسة" });
  return { session, student };
}

async function assertStudentReadAccess(user: AccessSubject, student: Awaited<ReturnType<typeof getStudentById>>) {
  if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "الطالب غير موجود" });
  // دفاع إضافي متوافق مع الروابط التاريخية؛ ثم تتحقق طبقة النطاق من روابط الأبناء المتعددة.
  if (user.role === "student" && student.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
  if (user.role === "guardian" && student.guardianUserId !== user.id) {
    const links = await getParentStudentLinks(user.id, student.centerId);
    if (!links.some((link) => link.studentId === student.id)) throw new TRPCError({ code: "FORBIDDEN" });
  }
  await assertStudentPermission(user, student.id, "reports.view", student.circleId);
  return student;
}

async function assertStudentManageAccess(user: AccessSubject, circleId: number | null | undefined, permission: "students.create" | "students.edit" | "students.delete", centerId?: number) {
  if (circleId) return assertCirclePermission(user, circleId, permission);
  if (TEACHING_ROLES.has(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم ربط الطالب بحلقة المعلم عند الإنشاء أو الإدارة" });
  if (!centerId) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم تحديد المركز أو الحلقة" });
  return assertPermission(user, centerId, permission);
}

async function resolveSessionCreateInput(user: AccessSubject, input: { circleId: number; teacherId?: number; seasonId?: number; title?: string; type: "regular" | "exam" | "review" | "special"; scheduledAt: Date; notes?: string }) {
  const circle = await getCircleById(input.circleId);
  if (!circle) throw new TRPCError({ code: "NOT_FOUND", message: "الحلقة غير موجودة" });
  await assertCirclePermission(user, circle.id, "attendance.create");
  if (TEACHING_ROLES.has(user.role)) {
    const teacher = await getTeacherByUserId(user.id);
    if (!teacher || (circle.teacherId !== teacher.id && circle.assistantTeacherId !== teacher.id)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك إنشاء جلسة إلا في حلقتك المرتبطة بحسابك" });
    if (input.teacherId != null && input.teacherId !== teacher.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعيين معلم آخر لجلسة حلقتك" });
    if (input.seasonId != null && input.seasonId !== circle.seasonId) throw new TRPCError({ code: "BAD_REQUEST", message: "الموسم المحدد لا يطابق موسم الحلقة" });
    return { ...input, teacherId: teacher.id, seasonId: circle.seasonId };
  }
  if (!input.teacherId || !input.seasonId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم اختيار المعلم والموسم الدراسي" });
  return input as Required<Pick<typeof input, "teacherId" | "seasonId">> & typeof input;
}

function assertQuranRange(input: { surahNumber: number; toSurahNumber?: number; fromAyah: number; toAyah: number }) {
  const message = getQuranRangeError(input);
  if (message) throw new TRPCError({ code: "BAD_REQUEST", message });
}

async function getAccessibleCenterIds(user: AccessSubject, permission: Parameters<typeof assertPermission>[2]) {
  const now = new Date();
  const memberships = await getUserCenterMemberships(user.id);
  const allowed = await Promise.all(memberships
    .filter((membership) => membership.status === "active" && !membership.revokedAt && (!membership.expiresAt || membership.expiresAt > now))
    .map(async (membership) => {
      try { await assertPermission(user, membership.centerId, permission); return membership.centerId; }
      catch { return null; }
    }));
  return allowed.filter((id): id is number => id != null);
}

async function filterAccessibleCircles(user: AccessSubject, items: Awaited<ReturnType<typeof getCircles>>) {
  const access = await Promise.all(items.map(async (circle) => {
    try { await assertTeacherCircleAccess(user, circle.id); return true; } catch { return false; }
  }));
  return items.filter((_, index) => access[index]);
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===================== DASHBOARD =====================
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      return getDashboardStatsForCenters(centerIds);
    }),
    recentSessions: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.view");
      return getRecentSessionsForCenters(centerIds, 5);
    }),
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
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const authorization = await assertPermission(ctx.user, input.id, "center.edit"); if (!authorization.membership.isOwner) throw new TRPCError({ code: "FORBIDDEN", message: "أرشفة المركز من صلاحية مالكه فقط" }); return softDeleteCenter(input.id); }),
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
      return createSession({ circleId: circle.id, teacherId: circle.teacherId, seasonId: circle.seasonId, title: `${period.name} · ${period.sessionType}`, type: "regular", scheduledAt: input.scheduledAt });
    }),
  }),

  mizan: router({
    monthlyRecord: protectedProcedure.input(z.object({ circleId: z.number(), startDate: z.date().optional(), endDate: z.date().optional() })).query(async ({ ctx, input }) => {
      await assertTeacherCircleAccess(ctx.user, input.circleId);
      return getCircleMonthlyRecord(input.circleId, input.startDate, input.endDate);
    }),
    studentProfile: protectedProcedure.input(z.object({ studentId: z.number(), startDate: z.date().optional(), endDate: z.date().optional() })).query(async ({ ctx, input }) => {
      const student = await getStudentById(input.studentId);
      await assertStudentReadAccess(ctx.user, student);
      return getStudentMizanProfile(input.studentId, input.startDate, input.endDate);
    }),
  }),

  // ===================== TEACHERS =====================
  teachers: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ ctx, input }) => {
      if (input.centerId) { await assertPermission(ctx.user, input.centerId, "teachers.view"); return getTeachers(input.centerId); }
      const centerIds = await getAccessibleCenterIds(ctx.user, "teachers.view");
      return (await Promise.all(centerIds.map((centerId) => getTeachers(centerId)))).flat();
    }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => { const teacher = await getTeacherById(input.id); if (!teacher) return teacher; await assertPermission(ctx.user, teacher.centerId, "teachers.view"); return teacher; }),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number(),
        name: z.string().min(2),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        nationalId: z.string().optional(),
        specialization: z.string().optional(),
        qualification: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, input.centerId, "teachers.create"); return createTeacher(input); }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        specialization: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const teacher = await getTeacherById(id); if (!teacher) throw new TRPCError({ code: "NOT_FOUND" }); await assertPermission(ctx.user, teacher.centerId, "teachers.edit");
        await updateTeacher(id, data);
      }),
    activity: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "teachers.view");
      const teachers = (await Promise.all(centerIds.map((centerId) => getTeachers(centerId)))).flat();
      const activities = await Promise.all(teachers.map(async (teacher) => [teacher.id, await getTeacherLastActivity(teacher.id)] as const));
      return Object.fromEntries(activities);
    }),
    transfer: protectedProcedure.input(z.object({ teacherId: z.number(), circleId: z.number(), role: z.enum(["teacher", "assistant_teacher"]) })).mutation(async ({ ctx, input }) => {
      const [teacher, circle] = await Promise.all([getTeacherById(input.teacherId), getCircleById(input.circleId)]);
      if (!teacher || !circle) throw new TRPCError({ code: "NOT_FOUND", message: "المعلم أو الحَلَقة غير موجودة" });
      await assertPermission(ctx.user, teacher.centerId, "teachers.edit"); await assertCirclePermission(ctx.user, circle.id, "circles.assign_teacher");
      const branch = await getBranchById(circle.branchId);
      if (!branch || branch.centerId !== teacher.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن نقل المعلم إلى حَلَقة خارج مركزه" });
      try {
        await transferTeacherToCircle(input.teacherId, input.circleId, input.role);
        return { success: true } as const;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر نقل المعلم" });
      }
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const teacher = await getTeacherById(input.id); if (!teacher) throw new TRPCError({ code: "NOT_FOUND" }); await assertPermission(ctx.user, teacher.centerId, "teachers.delete"); return softDeleteTeacher(input.id); }),
  }),

  // ===================== TEACHER INVITES =====================
  teacherInvites: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ ctx, input }) => {
      if (input.centerId) { await assertPermission(ctx.user, input.centerId, "access_codes.view"); return getTeacherInvites(input.centerId); }
      const centerIds = await getAccessibleCenterIds(ctx.user, "access_codes.view");
      return (await Promise.all(centerIds.map((centerId) => getTeacherInvites(centerId)))).flat();
    }),
    create: protectedProcedure.input(z.object({
      centerId: z.number(),
      circleId: z.number(),
      role: z.enum(["teacher", "assistant_teacher"]).default("teacher"),
      expiresAt: z.date().optional(),
    })).mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, input.centerId, "access_codes.create");
      await assertCirclePermission(ctx.user, input.circleId, "circles.view");
      if (await getCenterIdForCircle(input.circleId) !== input.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "الحلقة لا تنتمي إلى المركز المحدد" });
      const code = `TRTL-${randomBytes(4).toString("hex").toUpperCase()}`;
      await createTeacherInvite({ ...input, code, createdBy: ctx.user.id });
      return { code };
    }),
    revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const invite = await getTeacherInviteById(input.id);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });
      await assertPermission(ctx.user, invite.centerId, "access_codes.revoke");
      await assertScope(ctx.user, invite.centerId, { circleId: invite.circleId });
      await revokeTeacherInvite(input.id);
      return { success: true } as const;
    }),
    redeem: protectedProcedure.input(z.object({ code: z.string().trim().toUpperCase().regex(/^TRTL-[A-F0-9]{8}$/, "صيغة رمز الدعوة غير صحيحة") })).mutation(async ({ ctx, input }) => {
      try {
        return await redeemTeacherInvite(input.code, ctx.user.id);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر استرداد الدعوة" });
      }
    }),
  }),

  // ===================== STUDENTS =====================
  students: router({
    list: protectedProcedure
      .input(z.object({ centerId: z.number().optional(), circleId: z.number().optional(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "student") {
          const student = await getStudentByUserId(ctx.user.id);
          if (!student) return [];
          await assertStudentReadAccess(ctx.user, student);
          return [student];
        }
        if (ctx.user.role === "guardian") {
          const linked = await getStudentsByGuardianUserId(ctx.user.id);
          const permitted = await Promise.all(linked.map(async (student) => { try { await assertStudentReadAccess(ctx.user, student); return student; } catch { return null; } }));
          return permitted.filter((student): student is NonNullable<typeof student> => Boolean(student));
        }
        const scope = await getTeacherCircleScope(ctx.user);
        if (!scope) {
          if (input.circleId) { await assertCirclePermission(ctx.user, input.circleId, "students.view"); return getStudents(undefined, input.circleId, input.search); }
          const centerIds = input.centerId ? [input.centerId] : await getAccessibleCenterIds(ctx.user, "students.view");
          if (input.centerId) await assertPermission(ctx.user, input.centerId, "students.view");
          const candidates = (await Promise.all(centerIds.map((centerId) => getStudents(centerId, undefined, input.search)))).flat();
          const authorized = await Promise.all(candidates.map(async (student) => { try { await assertStudentPermission(ctx.user, student.id, "students.view", student.circleId); return student; } catch { return null; } }));
          return authorized.filter((student): student is NonNullable<typeof student> => Boolean(student));
        }
        if (input.circleId) {
          if (!scope.includes(input.circleId)) throw new TRPCError({ code: "FORBIDDEN" });
          return getStudents(undefined, input.circleId, input.search);
        }
        return (await Promise.all(scope.map((circleId) => getStudents(undefined, circleId, input.search)))).flat();
      }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const student = await getStudentById(input.id);
      return assertStudentReadAccess(ctx.user, student);
    }),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number().optional(),
        circleId: z.number().optional(),
        userId: z.number().optional(),
        guardianUserId: z.number().optional(),
        name: z.string().min(2),
        phone: z.string().optional(),
        guardianPhone: z.string().optional(),
        guardianName: z.string().optional(),
        nationalId: z.string().optional(),
        birthDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const circleCenterId = input.circleId ? await getCenterIdForCircle(input.circleId) : undefined;
        if (input.circleId && !circleCenterId) throw new TRPCError({ code: "NOT_FOUND", message: "الحلقة غير موجودة" });
        if (input.circleId && input.centerId && input.centerId !== circleCenterId) throw new TRPCError({ code: "BAD_REQUEST", message: "الحلقة لا تنتمي إلى المركز المحدد" });
        await assertStudentManageAccess(ctx.user, input.circleId, "students.create", circleCenterId ?? input.centerId);
        if (!circleCenterId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم تحديد المركز للطالب غير المرتبط بحلقة" });
        return createStudent({ ...input, centerId: circleCenterId });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        circleId: z.number().optional(),
        userId: z.number().optional(),
        guardianUserId: z.number().optional(),
        guardianName: z.string().nullable().optional(),
        guardianPhone: z.string().optional(),
        nationalId: z.string().nullable().optional(),
        birthDate: z.date().nullable().optional(),
        isActive: z.boolean().optional(),
        lastMemorizedSurah: z.number().optional(),
        lastMemorizedAyah: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const student = await getStudentById(id);
        await assertStudentManageAccess(ctx.user, student?.circleId, "students.edit", student?.centerId);
        if (data.circleId) await assertStudentManageAccess(ctx.user, data.circleId, "students.edit");
        await updateStudent(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const student = await getStudentById(input.id); await assertStudentManageAccess(ctx.user, student?.circleId, "students.delete", student?.centerId); return softDeleteStudent(input.id); }),
    memorizationHistory: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => { const student = await getStudentById(input.studentId); await assertStudentReadAccess(ctx.user, student); return getMemorizationByStudent(input.studentId); }),
  }),

  // ===================== SESSIONS =====================
  sessions: router({
    list: protectedProcedure
      .input(z.object({ circleId: z.number().optional(), seasonId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const scope = await getTeacherCircleScope(ctx.user);
        if (!scope) {
          if (input.circleId) { await assertCirclePermission(ctx.user, input.circleId, "attendance.view"); return getSessions(input.circleId, input.seasonId); }
          const circles = await filterAccessibleCircles(ctx.user, await getCircles());
          return (await Promise.all(circles.map((circle) => getSessions(circle.id, input.seasonId)))).flat();
        }
        if (input.circleId) {
          if (!scope.includes(input.circleId)) throw new TRPCError({ code: "FORBIDDEN" });
          return getSessions(input.circleId, input.seasonId);
        }
        return (await Promise.all(scope.map((circleId) => getSessions(circleId, input.seasonId)))).flat();
      }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => getAuthorizedSession(ctx.user, input.id)),
    create: protectedProcedure
      .input(z.object({
        circleId: z.number(),
        teacherId: z.number().optional(),
        seasonId: z.number().optional(),
        title: z.string().optional(),
        type: z.enum(["regular", "exam", "review", "special"]).default("regular"),
        scheduledAt: z.date(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => createSession(await resolveSessionCreateInput(ctx.user, input))),
    update: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string().nullable().optional(), type: z.enum(["regular", "exam", "review", "special"]).optional(), scheduledAt: z.date().optional(), notes: z.string().nullable().optional(), status: z.enum(["scheduled", "open", "closed", "cancelled"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getAuthorizedSession(ctx.user, input.id);
        await assertCirclePermission(ctx.user, session.circleId, "attendance.edit");
        const { id, ...data } = input;
        await updateSession(id, data);
        return { success: true } as const;
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["scheduled", "open", "closed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getAuthorizedSession(ctx.user, input.id); await assertCirclePermission(ctx.user, session.circleId, "attendance.edit");
        const updateData: Record<string, unknown> = { status: input.status };
        if (input.status === "open") updateData.startedAt = new Date();
        if (input.status === "closed") updateData.closedAt = new Date();
        await updateSession(input.id, updateData as any);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const session = await getAuthorizedSession(ctx.user, input.id); await assertCirclePermission(ctx.user, session.circleId, "attendance.edit"); return softDeleteSession(input.id); }),
  }),

  // ===================== ATTENDANCE =====================
  attendance: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => { await getAuthorizedSession(ctx.user, input.sessionId); return getAttendanceBySession(input.sessionId); }),
    upsert: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        status: z.enum(["present", "absent", "late", "excused"]),
        notes: z.string().optional(),
        recordedBy: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => { await assertSessionStudentMatch(ctx.user, input.sessionId, input.studentId); return upsertAttendance({ ...input, recordedBy: ctx.user.id }); }),
  }),

  // ===================== MEMORIZATION =====================
  memorization: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => { await getAuthorizedSession(ctx.user, input.sessionId); return getMemorizationBySession(input.sessionId); }),
    create: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        surahNumber: z.number().min(1).max(114),
        toSurahNumber: z.number().min(1).max(114).optional(),
        fromAyah: z.number().min(1),
        toAyah: z.number().min(1),
        pages: z.string().optional(),
        grade: z.enum(["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => { assertQuranRange(input); await assertSessionStudentMatch(ctx.user, input.sessionId, input.studentId); return createMemorization({ ...input, recordedBy: ctx.user.id }); }),
  }),

  // ===================== REVISION =====================
  revision: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => { await getAuthorizedSession(ctx.user, input.sessionId); return getRevisionBySession(input.sessionId); }),
    create: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        surahNumber: z.number().min(1).max(114),
        toSurahNumber: z.number().min(1).max(114).optional(),
        fromAyah: z.number().min(1),
        toAyah: z.number().min(1),
        pages: z.string().optional(),
        grade: z.enum(["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => { assertQuranRange(input); await assertSessionStudentMatch(ctx.user, input.sessionId, input.studentId); return createRevision({ ...input, recordedBy: ctx.user.id }); }),
  }),

  // ===================== EVALUATION =====================
  evaluation: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => { await getAuthorizedSession(ctx.user, input.sessionId); return getEvaluationBySession(input.sessionId); }),
    upsert: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        tajweedScore: z.number().min(0).max(100).optional(),
        pronunciationScore: z.number().min(0).max(100).optional(),
        memorizationScore: z.number().min(0).max(100).optional(),
        behaviorScore: z.number().min(0).max(100).optional(),
        totalScore: z.number().min(0).max(100).optional(),
        points: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => { await assertSessionStudentMatch(ctx.user, input.sessionId, input.studentId); return upsertEvaluation({ ...input, recordedBy: ctx.user.id }); }),
  }),

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

  // ===================== EXPORT =====================
  export: exportRouter,

  // ===================== UNIFIED REPORTING =====================
  reporting: reportingRouter,

  // ===================== AI ASSISTANT =====================
  ai: aiRouter,

  // ===================== TRASH =====================
  trash: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const centerIds = await getAccessibleCenterIds(ctx.user, "center.edit");
      return getTrashedItemsForCenters(centerIds);
    }),
    restore: protectedProcedure
      .input(z.object({ table: z.enum(["centers", "branches", "teachers", "students", "circles", "sessions"]), id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const centerId = await getTrashedItemCenterId(input.table, input.id);
        if (!centerId) throw new TRPCError({ code: "NOT_FOUND" });
        await assertPermission(ctx.user, centerId, "center.edit");
        return restoreItem(input.table, input.id);
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

  // ===================== ACCESS CONTROL =====================
  access: router({
    mine: protectedProcedure.query(async ({ ctx }) => getUserCenterMemberships(ctx.user.id)),

    members: protectedProcedure.input(z.object({ centerId: z.number() })).query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, input.centerId, "users.view");
      const rows = await getCenterMembers(input.centerId);
      return rows.map(({ membership, user }) => ({ membership, user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, accountStatus: user.accountStatus, lastSignedIn: user.lastSignedIn } }));
    }),

    memberDetail: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const membership = await getCenterMemberById(input.id);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "العضوية غير موجودة" });
      await assertPermission(ctx.user, membership.centerId, "users.view");
      const authorization = await getAuthorization({ id: membership.userId, role: membership.role, isActive: true, accountStatus: "active", accessRevokedAt: null }, membership.centerId);
      return { membership, permissions: Array.from(authorization.permissions), scopes: authorization.scopes };
    }),

    createPendingMember: protectedProcedure.input(z.object({ centerId: z.number(), userId: z.number(), role: z.enum(["supervisor", "guide", "teacher", "assistant_teacher"]), expiresAt: z.date().optional() })).mutation(async ({ ctx, input }) => {
      const required = input.role === "supervisor" ? "supervisors.create" : input.role === "guide" ? "guides.create" : "teachers.create";
      await assertPermission(ctx.user, input.centerId, required);
      const auth = await getAuthorization(ctx.user, input.centerId);
      if (!auth.membership.isOwner && input.role === "supervisor") throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء المشرفين من صلاحية مالك المركز فقط" });
      const id = await createCenterMembership({ userId: input.userId, centerId: input.centerId, role: input.role, status: "pending", grantedBy: ctx.user.id, expiresAt: input.expiresAt });
      await createAuditLog({ userId: ctx.user.id, centerId: input.centerId, action: "access.member.create", entity: "center_membership", entityId: id, newData: JSON.stringify({ userId: input.userId, role: input.role }) });
      return { id };
    }),

    updateMember: protectedProcedure.input(z.object({ id: z.number(), status: z.enum(["pending", "active", "suspended", "disabled", "archived"]).optional(), expiresAt: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
      const membership = await getCenterMemberById(input.id);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "العضوية غير موجودة" });
      const auth = await assertPermission(ctx.user, membership.centerId, "users.edit");
      if (membership.isOwner || membership.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعديل ملكية المركز أو وصولك الشخصي من هنا" });
      if (!auth.membership.isOwner && membership.role === "supervisor") throw new TRPCError({ code: "FORBIDDEN", message: "إدارة المشرفين من صلاحية مالك المركز فقط" });
      await updateCenterMembership(input.id, { status: input.status, expiresAt: input.expiresAt ?? undefined, revokedAt: input.status && input.status !== "active" ? new Date() : null });
      await createAuditLog({ userId: ctx.user.id, centerId: membership.centerId, action: "access.member.status", entity: "center_membership", entityId: membership.id, oldData: JSON.stringify({ status: membership.status }), newData: JSON.stringify({ status: input.status }) });
      return { success: true };
    }),

    setDelegatedAccess: protectedProcedure.input(z.object({ membershipId: z.number(), permissions: z.array(z.enum(GRANULAR_PERMISSIONS)).max(64), scopes: z.array(z.object({ scopeType: z.enum(["center", "circle", "teacher", "student"]), scopeId: z.number().nullable().optional() })).max(64), expiresAt: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
      const membership = await getCenterMemberById(input.membershipId);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "العضوية غير موجودة" });
      const auth = await assertPermission(ctx.user, membership.centerId, "users.edit");
      const isTeacherMembership = membership.role === "teacher" || membership.role === "assistant_teacher";
      if (isTeacherMembership && (input.scopes.length !== 1 || input.scopes[0]?.scopeType !== "circle" || !input.scopes[0]?.scopeId)) throw new TRPCError({ code: "BAD_REQUEST", message: "تفويض المعلم يجب أن يقتصر على حلقة واحدة فقط" });
      if (isTeacherMembership && await getCenterIdForCircle(input.scopes[0]!.scopeId!) !== membership.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "حلقة المعلم لا تنتمي إلى مركز العضوية" });
      if (membership.isOwner || membership.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تعديل تفويض مالك المركز أو تفويضك الشخصي" });
      if (!auth.membership.isOwner && membership.role === "supervisor") throw new TRPCError({ code: "FORBIDDEN", message: "تعديل تفويض المشرف من صلاحية مالك المركز فقط" });
      await assertCanDelegate(ctx.user, membership.centerId, input.permissions, input.scopes.map((scope) => scope.scopeId).filter((id): id is number => id != null));
      await revokeUserPermissionGrants(membership.userId, membership.centerId);
      await revokeUserScopes(membership.userId, membership.centerId);
      await createPermissionGrants(input.permissions.map((permission) => ({ userId: membership.userId, centerId: membership.centerId, permission, effect: "allow" as const, grantedBy: ctx.user.id, expiresAt: input.expiresAt ?? null })));
      await createUserScopes(input.scopes.map((scope) => ({ userId: membership.userId, centerId: membership.centerId, scopeType: scope.scopeType, scopeId: scope.scopeId ?? null, grantedBy: ctx.user.id, expiresAt: input.expiresAt ?? null })));
      await updateCenterMembership(membership.id, { expiresAt: input.expiresAt ?? undefined });
      await createAuditLog({ userId: ctx.user.id, centerId: membership.centerId, action: "access.delegation.update", entity: "center_membership", entityId: membership.id, newData: JSON.stringify({ permissions: input.permissions, scopes: input.scopes, expiresAt: input.expiresAt }) });
      return { success: true };
    }),

    codes: router({
      list: protectedProcedure.input(z.object({ centerId: z.number() })).query(async ({ ctx, input }) => {
        await assertPermission(ctx.user, input.centerId, "access_codes.view");
        const codes = await getAccessCodesForCenter(input.centerId);
        return codes.map(({ codeHash: _codeHash, ...code }) => code);
      }),
      create: protectedProcedure.input(z.object({ centerId: z.number(), role: z.enum(["supervisor", "guide", "teacher", "assistant_teacher", "student", "guardian"]), circleId: z.number().optional(), teacherId: z.number().optional(), studentId: z.number().optional(), guardianUserId: z.number().optional(), expiresAt: z.date().optional(), maxUses: z.number().int().min(1).max(20).default(1), scopes: z.array(z.object({ scopeType: z.enum(["center", "circle", "teacher", "student"]), scopeId: z.number().nullable().optional() })).max(32).default([]) })).mutation(async ({ ctx, input }) => {
        const auth = await assertPermission(ctx.user, input.centerId, "access_codes.create");
        const rolePermissions = ROLE_PERMISSION_TEMPLATES[input.role];
        const isTeacherCode = input.role === "teacher" || input.role === "assistant_teacher";
        if (input.role === "supervisor" && !auth.membership.isOwner) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء كود مشرف من صلاحية مالك المركز فقط" });
        if (isTeacherCode && !input.circleId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم ربط كود المعلم بحلقة واحدة محددة" });
        if (isTeacherCode && input.maxUses !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "كود المعلم مخصص لمعلم واحد واستخدام واحد فقط" });
        if (["student", "guardian"].includes(input.role) && !input.studentId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم ربط كود الطالب أو ولي الأمر بطالب محدد" });
        if (["teacher", "assistant_teacher", "student", "guardian"].includes(input.role) && input.scopes.some((scope) => scope.scopeType === "center")) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يجوز منح هذا الدور نطاق المركز كاملاً" });
        if (input.circleId && await getCenterIdForCircle(input.circleId) !== input.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "الحلقة لا تنتمي إلى المركز المحدد" });
        if (input.studentId && await getCenterIdForStudent(input.studentId) !== input.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "الطالب لا ينتمي إلى المركز المحدد" });
        const codeScopes = isTeacherCode ? [{ scopeType: "circle" as const, scopeId: input.circleId! }] : input.scopes;
        if (isTeacherCode) {
          const circle = await getCircleById(input.circleId!);
          if (!circle) throw new TRPCError({ code: "BAD_REQUEST", message: "الحلقة غير متاحة" });
          const assignedTeacherId = input.role === "teacher" ? circle.teacherId : circle.assistantTeacherId;
          if (assignedTeacherId) throw new TRPCError({ code: "BAD_REQUEST", message: "مقعد المعلم في الحلقة مرتبط بملف معلم بالفعل" });
        }
        await assertCanDelegate(ctx.user, input.centerId, rolePermissions, codeScopes.map((scope) => scope.scopeId).filter((id): id is number => id != null));
        const rawCode = createAccessCodeSecret();
        const codeHash = hashAccessCode(rawCode);
        const hint = getAccessCodeHint(rawCode);
        const id = await createAccessCode({ centerId: input.centerId, codeHash, codeHint: hint, role: input.role, scopeJson: JSON.stringify(codeScopes), circleId: input.circleId, teacherId: input.teacherId, studentId: input.studentId, guardianUserId: input.guardianUserId, createdBy: ctx.user.id, expiresAt: input.expiresAt, maxUses: isTeacherCode ? 1 : input.maxUses });
        await createAuditLog({ userId: ctx.user.id, centerId: input.centerId, action: "access.code.create", entity: "access_code", entityId: id, newData: JSON.stringify({ role: input.role, codeHint: hint, maxUses: input.maxUses, expiresAt: input.expiresAt }) });
        return { id, code: rawCode, hint };
      }),
      revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const code = await getAccessCodeById(input.id);
        if (!code) throw new TRPCError({ code: "NOT_FOUND", message: "الكود غير موجود" });
        await assertPermission(ctx.user, code.centerId, "access_codes.revoke");
        if (code.circleId) await assertScope(ctx.user, code.centerId, { circleId: code.circleId });
        if (code.studentId) await assertScope(ctx.user, code.centerId, { studentId: code.studentId });
        await revokeAccessCode(code.id);
        await createAuditLog({ userId: ctx.user.id, centerId: code.centerId, action: "access.code.revoke", entity: "access_code", entityId: code.id, oldData: JSON.stringify({ status: code.status, codeHint: code.codeHint }) });
        return { success: true };
      }),
      reissue: protectedProcedure.input(z.object({ id: z.number(), expiresAt: z.date().optional() })).mutation(async ({ ctx, input }) => {
        const previous = await getAccessCodeById(input.id);
        if (!previous) throw new TRPCError({ code: "NOT_FOUND", message: "الكود غير موجود" });
        await assertPermission(ctx.user, previous.centerId, "access_codes.create");
        if (previous.circleId) await assertScope(ctx.user, previous.centerId, { circleId: previous.circleId });
        if (previous.studentId) await assertScope(ctx.user, previous.centerId, { studentId: previous.studentId });
        const rawCode = createAccessCodeSecret();
        const hint = getAccessCodeHint(rawCode);
        const id = await createAccessCode({ centerId: previous.centerId, codeHash: hashAccessCode(rawCode), codeHint: hint, role: previous.role, scopeJson: previous.scopeJson, circleId: previous.circleId, teacherId: previous.teacherId, studentId: previous.studentId, guardianUserId: previous.guardianUserId, createdBy: ctx.user.id, expiresAt: input.expiresAt ?? previous.expiresAt ?? undefined, maxUses: previous.maxUses });
        if (previous.status === "active") await revokeAccessCode(previous.id);
        await createAuditLog({ userId: ctx.user.id, centerId: previous.centerId, action: "access.code.reissue", entity: "access_code", entityId: id, oldData: JSON.stringify({ previousId: previous.id, codeHint: previous.codeHint }), newData: JSON.stringify({ codeHint: hint, role: previous.role }) });
        return { id, code: rawCode, hint };
      }),
      redeem: protectedProcedure.input(z.object({ code: z.string().min(8).max(128) })).mutation(async ({ ctx, input }) => {
        const codeHash = hashAccessCode(input.code);
        const result = await redeemAccessCodeSecure({ codeHash, userId: ctx.user.id, ipAddress: ctx.req.ip, userAgent: ctx.req.get("user-agent") ?? undefined });
        await createAuditLog({ userId: ctx.user.id, centerId: result.centerId, action: "access.code.redeem", entity: "access_code", newData: JSON.stringify({ role: result.role, status: result.status }) });
        return result;
      }),
    }),
    securityActivity: protectedProcedure.input(z.object({ centerId: z.number() })).query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, input.centerId, "audit_logs.view");
      return getAuditLogForCenter(input.centerId, 100);
    }),
  }),
});

export type AppRouter = typeof appRouter;
