import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
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
  getAcademicSeasons,
  getAllUsers,
  getAttendanceBySession,
  getAuditLog,
  getBranchById,
  getBranches,
  getCenterById,
  getCenters,
  getCircleById,
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
  getTeachers,
  getTrashedItems,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  restoreItem,
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

  // ===================== STUDENTS =====================
  students: router({
    list: protectedProcedure
      .input(z.object({ centerId: z.number().optional(), circleId: z.number().optional(), search: z.string().optional() }))
      .query(async ({ input }) => getStudents(input.centerId, input.circleId, input.search)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getStudentById(input.id)),
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
      .mutation(async ({ input }) => createStudent(input)),
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateStudent(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => softDeleteStudent(input.id)),
    memorizationHistory: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ input }) => getMemorizationByStudent(input.studentId)),
  }),

  // ===================== SESSIONS =====================
  sessions: router({
    list: protectedProcedure
      .input(z.object({ circleId: z.number().optional(), seasonId: z.number().optional() }))
      .query(async ({ input }) => getSessions(input.circleId, input.seasonId)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => getSessionById(input.id)),
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
      .mutation(async ({ input }) => createSession(input)),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["scheduled", "open", "closed", "cancelled"]),
      }))
      .mutation(async ({ input }) => {
        const updateData: Record<string, unknown> = { status: input.status };
        if (input.status === "open") updateData.startedAt = new Date();
        if (input.status === "closed") updateData.closedAt = new Date();
        await updateSession(input.id, updateData as any);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => softDeleteSession(input.id)),
  }),

  // ===================== ATTENDANCE =====================
  attendance: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => getAttendanceBySession(input.sessionId)),
    upsert: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        status: z.enum(["present", "absent", "late", "excused"]),
        notes: z.string().optional(),
        recordedBy: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => upsertAttendance({ ...input, recordedBy: ctx.user.id })),
  }),

  // ===================== MEMORIZATION =====================
  memorization: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => getMemorizationBySession(input.sessionId)),
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
      .mutation(async ({ input, ctx }) => createMemorization({ ...input, recordedBy: ctx.user.id })),
  }),

  // ===================== REVISION =====================
  revision: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => getRevisionBySession(input.sessionId)),
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
      .mutation(async ({ input, ctx }) => createRevision({ ...input, recordedBy: ctx.user.id })),
  }),

  // ===================== EVALUATION =====================
  evaluation: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => getEvaluationBySession(input.sessionId)),
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
      .mutation(async ({ input, ctx }) => upsertEvaluation({ ...input, recordedBy: ctx.user.id })),
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
