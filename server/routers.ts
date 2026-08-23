import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { hasTarteelPermission } from "../shared/permissions";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { exportRouter } from "./routers/export";
import { aiRouter } from "./routers/ai";
import {
  createAcademicSeason,
  createBranch,
  createCenter,
  createCircle,
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
  getAllUsers,
  getAttendanceBySession,
  getAuditLog,
  getBranchById,
  getBranches,
  getCenterById,
  getCenters,
  getCircleById,
  getCircleIdsForTeacher,
  getCircles,
  getDashboardStats,
  getEvaluationBySession,
  getMemorizationBySession,
  getMemorizationByStudent,
  getNotificationsByUser,
  getOrganizationById,
  getOrganizations,
  getRecentSessions,
  getRevisionBySession,
  getSessionById,
  getSessions,
  getStudentById,
  getStudents,
  getTeacherById,
  getTeacherByUserId,
  getTeacherInvites,
  getTeachers,
  getTrashedItems,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  restoreItem,
  revokeTeacherInvite,
  softDeleteBranch,
  softDeleteCenter,
  softDeleteCircle,
  softDeleteSession,
  softDeleteStudent,
  softDeleteTeacher,
  updateAcademicSeason,
  updateBranch,
  updateCenter,
  updateCircle,
  updateSession,
  updateStudent,
  updateTeacher,
  upsertAttendance,
  upsertEvaluation,
} from "./db";

const TEACHING_ROLES = new Set(["teacher", "assistant_teacher"]);

async function getTeacherCircleScope(user: { id: number; role: string }) {
  if (!TEACHING_ROLES.has(user.role)) return null;
  const teacher = await getTeacherByUserId(user.id);
  if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "لا يوجد ملف معلم مرتبط بحسابك" });
  return getCircleIdsForTeacher(teacher.id);
}

async function assertTeacherCircleAccess(user: { id: number; role: string }, circleId: number | null | undefined) {
  const scope = await getTeacherCircleScope(user);
  if (scope && (!circleId || !scope.includes(circleId))) throw new TRPCError({ code: "FORBIDDEN", message: "هذه البيانات لا تنتمي إلى حَلَقَتك" });
}

async function getAuthorizedSession(user: { id: number; role: string }, sessionId: number) {
  const session = await getSessionById(sessionId);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "الجلسة غير موجودة" });
  await assertTeacherCircleAccess(user, session.circleId);
  return session;
}

async function assertSessionStudentMatch(user: { id: number; role: string }, sessionId: number, studentId: number) {
  const [session, student] = await Promise.all([getAuthorizedSession(user, sessionId), getStudentById(studentId)]);
  if (!student || student.circleId !== session.circleId) throw new TRPCError({ code: "BAD_REQUEST", message: "الطالب لا ينتمي إلى حَلَقَة هذه الجلسة" });
  return { session, student };
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
    stats: protectedProcedure.query(async () => {
      return getDashboardStats();
    }),
    recentSessions: protectedProcedure.query(async () => {
      return getRecentSessions(5);
    }),
  }),

  // ===================== ORGANIZATIONS =====================
  organizations: router({
    list: protectedProcedure.query(async () => getOrganizations()),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getOrganizationById(input.id)),
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
      .mutation(async ({ input }) => createOrganization(input)),
  }),

  // ===================== CENTERS =====================
  centers: router({
    list: protectedProcedure.input(z.object({ orgId: z.number().optional() })).query(async ({ input }) => getCenters(input.orgId)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getCenterById(input.id)),
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
      .mutation(async ({ input }) => createCenter(input)),
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateCenter(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => softDeleteCenter(input.id)),
  }),

  // ===================== BRANCHES =====================
  branches: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ input }) => getBranches(input.centerId)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getBranchById(input.id)),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number(),
        name: z.string().min(2),
        description: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        supervisorId: z.number().optional(),
      }))
      .mutation(async ({ input }) => createBranch(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateBranch(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => softDeleteBranch(input.id)),
  }),

  // ===================== ACADEMIC SEASONS =====================
  seasons: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ input }) => getAcademicSeasons(input.centerId)),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number(),
        name: z.string().min(2),
        type: z.enum(["academic_year", "semester", "summer", "ramadan", "custom"]),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .mutation(async ({ input }) => createAcademicSeason(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateAcademicSeason(id, data);
      }),
  }),

  // ===================== CIRCLES =====================
  circles: router({
    list: protectedProcedure.input(z.object({ branchId: z.number().optional(), seasonId: z.number().optional() })).query(async ({ input }) => getCircles(input.branchId, input.seasonId)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getCircleById(input.id)),
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
      .mutation(async ({ input }) => createCircle(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        teacherId: z.number().optional(),
        maxStudents: z.number().optional(),
        schedule: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateCircle(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => softDeleteCircle(input.id)),
  }),

  // ===================== TEACHERS =====================
  teachers: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ input }) => getTeachers(input.centerId)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getTeacherById(input.id)),
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
      .mutation(async ({ input }) => createTeacher(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        specialization: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateTeacher(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => softDeleteTeacher(input.id)),
  }),

  // ===================== TEACHER INVITES =====================
  teacherInvites: router({
    list: protectedProcedure.input(z.object({ centerId: z.number().optional() })).query(async ({ ctx, input }) => {
      if (!hasTarteelPermission(ctx.user.role, "teachers:manage")) throw new TRPCError({ code: "FORBIDDEN" });
      return getTeacherInvites(input.centerId);
    }),
    create: protectedProcedure.input(z.object({
      centerId: z.number(),
      circleId: z.number(),
      role: z.enum(["teacher", "assistant_teacher"]).default("teacher"),
      expiresAt: z.date().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (!hasTarteelPermission(ctx.user.role, "teachers:manage")) throw new TRPCError({ code: "FORBIDDEN" });
      const code = `TRTL-${randomBytes(4).toString("hex").toUpperCase()}`;
      await createTeacherInvite({ ...input, code, createdBy: ctx.user.id });
      return { code };
    }),
    revoke: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (!hasTarteelPermission(ctx.user.role, "teachers:manage")) throw new TRPCError({ code: "FORBIDDEN" });
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
        const scope = await getTeacherCircleScope(ctx.user);
        if (!scope) return getStudents(input.centerId, input.circleId, input.search);
        if (input.circleId) {
          if (!scope.includes(input.circleId)) throw new TRPCError({ code: "FORBIDDEN" });
          return getStudents(undefined, input.circleId, input.search);
        }
        return (await Promise.all(scope.map((circleId) => getStudents(undefined, circleId, input.search)))).flat();
      }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const student = await getStudentById(input.id);
      if (!student) return student;
      await assertTeacherCircleAccess(ctx.user, student.circleId);
      return student;
    }),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number(),
        circleId: z.number().optional(),
        name: z.string().min(2),
        phone: z.string().optional(),
        guardianPhone: z.string().optional(),
        guardianName: z.string().optional(),
        nationalId: z.string().optional(),
        birthDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => { await assertTeacherCircleAccess(ctx.user, input.circleId); return createStudent(input); }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        circleId: z.number().optional(),
        guardianPhone: z.string().optional(),
        isActive: z.boolean().optional(),
        lastMemorizedSurah: z.number().optional(),
        lastMemorizedAyah: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const student = await getStudentById(id);
        await assertTeacherCircleAccess(ctx.user, student?.circleId);
        if (data.circleId) await assertTeacherCircleAccess(ctx.user, data.circleId);
        await updateStudent(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const student = await getStudentById(input.id); await assertTeacherCircleAccess(ctx.user, student?.circleId); return softDeleteStudent(input.id); }),
    memorizationHistory: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => { const student = await getStudentById(input.studentId); await assertTeacherCircleAccess(ctx.user, student?.circleId); return getMemorizationByStudent(input.studentId); }),
  }),

  // ===================== SESSIONS =====================
  sessions: router({
    list: protectedProcedure
      .input(z.object({ circleId: z.number().optional(), seasonId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const scope = await getTeacherCircleScope(ctx.user);
        if (!scope) return getSessions(input.circleId, input.seasonId);
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
        teacherId: z.number(),
        seasonId: z.number(),
        title: z.string().optional(),
        type: z.enum(["regular", "exam", "review", "special"]).default("regular"),
        scheduledAt: z.date(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => { await assertTeacherCircleAccess(ctx.user, input.circleId); return createSession(input); }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["scheduled", "open", "closed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await getAuthorizedSession(ctx.user, input.id);
        const updateData: Record<string, unknown> = { status: input.status };
        if (input.status === "open") updateData.startedAt = new Date();
        if (input.status === "closed") updateData.closedAt = new Date();
        await updateSession(input.id, updateData as any);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { await getAuthorizedSession(ctx.user, input.id); return softDeleteSession(input.id); }),
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
        fromAyah: z.number().min(1),
        toAyah: z.number().min(1),
        pages: z.string().optional(),
        grade: z.enum(["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => { await assertSessionStudentMatch(ctx.user, input.sessionId, input.studentId); return createMemorization({ ...input, recordedBy: ctx.user.id }); }),
  }),

  // ===================== REVISION =====================
  revision: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => { await getAuthorizedSession(ctx.user, input.sessionId); return getRevisionBySession(input.sessionId); }),
    create: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        surahNumber: z.number().min(1).max(114),
        fromAyah: z.number().min(1),
        toAyah: z.number().min(1),
        pages: z.string().optional(),
        grade: z.enum(["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => { await assertSessionStudentMatch(ctx.user, input.sessionId, input.studentId); return createRevision({ ...input, recordedBy: ctx.user.id }); }),
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
    list: protectedProcedure.query(async () => getAuditLog(50)),
  }),

  // ===================== EXPORT =====================
  export: exportRouter,

  // ===================== AI ASSISTANT =====================
  ai: aiRouter,

  // ===================== TRASH =====================
  trash: router({
    list: protectedProcedure.query(async () => getTrashedItems()),
    restore: protectedProcedure
      .input(z.object({ table: z.string(), id: z.number() }))
      .mutation(async ({ input }) => restoreItem(input.table, input.id)),
  }),

  // ===================== USERS =====================
  users: router({
    list: protectedProcedure.query(async () => getAllUsers()),
  }),
});

export type AppRouter = typeof appRouter;
