import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { hasTarteelPermission } from "../shared/permissions";
import { getQuranRangeError } from "../shared/mizan";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { exportRouter } from "./routers/export";
import { aiRouter } from "./routers/ai";
import { reportingRouter } from "./routers/reporting";
import {
  createAcademicSeason,
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
  getAllUsers,
  getAttendanceBySession,
  getAuditLog,
  getBranchById,
  getBranches,
  getCenterById,
  getCenters,
  getCircleById,
  getCircleIdsForTeacher,
  getCirclePeriodById,
  getCirclePeriods,
  getCircleMonthlyRecord,
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
  getStudentMizanProfile,
  getStudentByUserId,
  getStudentsByGuardianUserId,
  getStudents,
  getTeacherById,
  getTeacherByUserId,
  getTeacherInvites,
  getTeacherLastActivity,
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

async function assertStudentReadAccess(user: { id: number; role: string }, student: Awaited<ReturnType<typeof getStudentById>>) {
  if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "الطالب غير موجود" });
  if (user.role === "student" && student.userId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
  if (user.role === "guardian" && student.guardianUserId !== user.id) throw new TRPCError({ code: "FORBIDDEN" });
  await assertTeacherCircleAccess(user, student.circleId);
  return student;
}

async function assertStudentManageAccess(user: { id: number; role: string }, circleId: number | null | undefined) {
  if (!TEACHING_ROLES.has(user.role) && !hasTarteelPermission(user.role, "students:manage")) throw new TRPCError({ code: "FORBIDDEN" });
  await assertTeacherCircleAccess(user, circleId);
}

function assertQuranRange(input: { surahNumber: number; toSurahNumber?: number; fromAyah: number; toAyah: number }) {
  const message = getQuranRangeError(input);
  if (message) throw new TRPCError({ code: "BAD_REQUEST", message });
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
    list: protectedProcedure.input(z.object({ branchId: z.number().optional(), seasonId: z.number().optional() })).query(async ({ ctx, input }) => {
      const scope = await getTeacherCircleScope(ctx.user);
      if (!scope) return getCircles(input.branchId, input.seasonId);
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
      .mutation(async ({ ctx, input }) => { if (!hasTarteelPermission(ctx.user.role, "circles:manage")) throw new TRPCError({ code: "FORBIDDEN" }); return createCircle(input); }),
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
        await assertTeacherCircleAccess(ctx.user, circle?.id);
        await updateCircle(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { if (!hasTarteelPermission(ctx.user.role, "circles:manage")) throw new TRPCError({ code: "FORBIDDEN" }); return softDeleteCircle(input.id); }),
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
    activity: protectedProcedure.query(async ({ ctx }) => {
      if (!hasTarteelPermission(ctx.user.role, "teachers:manage")) throw new TRPCError({ code: "FORBIDDEN" });
      const teachers = await getTeachers();
      const activities = await Promise.all(teachers.map(async (teacher) => [teacher.id, await getTeacherLastActivity(teacher.id)] as const));
      return Object.fromEntries(activities);
    }),
    transfer: protectedProcedure.input(z.object({ teacherId: z.number(), circleId: z.number(), role: z.enum(["teacher", "assistant_teacher"]) })).mutation(async ({ ctx, input }) => {
      if (!hasTarteelPermission(ctx.user.role, "teachers:manage")) throw new TRPCError({ code: "FORBIDDEN" });
      const [teacher, circle] = await Promise.all([getTeacherById(input.teacherId), getCircleById(input.circleId)]);
      if (!teacher || !circle) throw new TRPCError({ code: "NOT_FOUND", message: "المعلم أو الحَلَقة غير موجودة" });
      const branch = await getBranchById(circle.branchId);
      if (!branch || branch.centerId !== teacher.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن نقل المعلم إلى حَلَقة خارج مركزه" });
      try {
        await transferTeacherToCircle(input.teacherId, input.circleId, input.role);
        return { success: true } as const;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر نقل المعلم" });
      }
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
        if (ctx.user.role === "student") {
          const student = await getStudentByUserId(ctx.user.id);
          return student ? [student] : [];
        }
        if (ctx.user.role === "guardian") return getStudentsByGuardianUserId(ctx.user.id);
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
      return assertStudentReadAccess(ctx.user, student);
    }),
    create: protectedProcedure
      .input(z.object({
        centerId: z.number(),
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
      .mutation(async ({ ctx, input }) => { await assertStudentManageAccess(ctx.user, input.circleId); return createStudent(input); }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        circleId: z.number().optional(),
        userId: z.number().optional(),
        guardianUserId: z.number().optional(),
        guardianPhone: z.string().optional(),
        isActive: z.boolean().optional(),
        lastMemorizedSurah: z.number().optional(),
        lastMemorizedAyah: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const student = await getStudentById(id);
        await assertStudentManageAccess(ctx.user, student?.circleId);
        if (data.circleId) await assertStudentManageAccess(ctx.user, data.circleId);
        await updateStudent(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const student = await getStudentById(input.id); await assertStudentManageAccess(ctx.user, student?.circleId); return softDeleteStudent(input.id); }),
    memorizationHistory: protectedProcedure.input(z.object({ studentId: z.number() })).query(async ({ ctx, input }) => { const student = await getStudentById(input.studentId); await assertStudentReadAccess(ctx.user, student); return getMemorizationByStudent(input.studentId); }),
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
    list: protectedProcedure.query(async () => getAuditLog(50)),
  }),

  // ===================== EXPORT =====================
  export: exportRouter,

  // ===================== UNIFIED REPORTING =====================
  reporting: reportingRouter,

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
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!hasTarteelPermission(ctx.user.role, "students:manage")) throw new TRPCError({ code: "FORBIDDEN" });
      return getAllUsers();
    }),
  }),
});

export type AppRouter = typeof appRouter;
