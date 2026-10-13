/** موجّهات tRPC: الجلسات والحضور والحفظ والمراجعة والتقييم. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { assertCirclePermission } from "../accessControl";

import { getRiyadhDayKey } from "../../shared/dates";

import { protectedProcedure, router } from "../_core/trpc";

import {
  createMemorization,
  createRevision,
  getAttendanceBySession,
  getCircles,
  getEvaluationBySession,
  getMemorizationBySession,
  getLatestStudentPeriodProgress,
  getRevisionBySession,
  getSessionByCircleDay,
  getSessions,
  getStudents,
  softDeleteSession,
  updateSession,
  markUnrecordedAttendancePresent,
  upsertAttendance,
  upsertEvaluation,
} from "../db";
import { assertQuranRange, assertSessionStudentMatch, assertTeacherCircleAccess, createDailyPeriod, filterAccessibleCircles, getAuthorizedSession, getTeacherCircleScope } from "./_shared";

export const sessionsRouters = {

  // ===================== SESSIONS =====================
  sessions: router({
    list: protectedProcedure
      .input(z.object({ circleId: z.number().optional(), seasonId: z.number().optional(), includeDrafts: z.boolean().optional().default(false) }))
      .query(async ({ ctx, input }) => {
        const scope = await getTeacherCircleScope(ctx.user);
        if (!scope) {
          if (input.circleId) { await assertCirclePermission(ctx.user, input.circleId, "attendance.view"); return getSessions(input.circleId, input.seasonId, input.includeDrafts); }
          const circles = await filterAccessibleCircles(ctx.user, await getCircles());
          return (await Promise.all(circles.map((circle) => getSessions(circle.id, input.seasonId, input.includeDrafts)))).flat();
        }
        if (input.circleId) {
          if (!scope.includes(input.circleId)) throw new TRPCError({ code: "FORBIDDEN" });
          return getSessions(input.circleId, input.seasonId, input.includeDrafts);
        }
        return (await Promise.all(scope.map((circleId) => getSessions(circleId, input.seasonId, input.includeDrafts)))).flat();
      }),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => getAuthorizedSession(ctx.user, input.id)),
    byDay: protectedProcedure.input(z.object({ circleId: z.number(), scheduledAt: z.date() })).query(async ({ ctx, input }) => {
      await assertCirclePermission(ctx.user, input.circleId, "attendance.view");
      const session = await getSessionByCircleDay(input.circleId, getRiyadhDayKey(input.scheduledAt));
      return session ? getAuthorizedSession(ctx.user, session.id) : null;
    }),
    latestStudentProgress: protectedProcedure.input(z.object({ circleId: z.number() })).query(async ({ ctx, input }) => {
      await assertTeacherCircleAccess(ctx.user, input.circleId);
      return getLatestStudentPeriodProgress(input.circleId);
    }),
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
      .mutation(async ({ ctx, input }) => createDailyPeriod(ctx.user, input)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string().nullable().optional(), type: z.enum(["regular", "exam", "review", "special"]).optional(), scheduledAt: z.date().optional(), notes: z.string().nullable().optional(), status: z.enum(["draft", "scheduled", "open", "closed", "cancelled"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getAuthorizedSession(ctx.user, input.id);
        await assertCirclePermission(ctx.user, session.circleId, "attendance.edit");
        const { id, ...data } = input;
        if (data.scheduledAt) {
          const dayKey = getRiyadhDayKey(data.scheduledAt);
          const duplicate = await getSessionByCircleDay(session.circleId, dayKey);
          if (duplicate && duplicate.id !== id) throw new TRPCError({ code: "CONFLICT", message: "توجد بالفعل فترة لهذه الحلقة في اليوم المحدد" });
          Object.assign(data, { dayKey });
        }
        await updateSession(id, data);
        return { success: true } as const;
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "scheduled", "open", "closed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getAuthorizedSession(ctx.user, input.id); await assertCirclePermission(ctx.user, session.circleId, "attendance.edit");
        const updateData: Record<string, unknown> = { status: input.status };
        if (input.status === "open") updateData.startedAt = new Date();
        if (input.status === "closed") updateData.closedAt = new Date();
        await updateSession(input.id, updateData as any);
      }),
    finalize: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getAuthorizedSession(ctx.user, input.id);
      await assertCirclePermission(ctx.user, session.circleId, "attendance.edit");
      if (session.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اعتماد فترة ملغاة" });
      await updateSession(input.id, { status: "closed", closedAt: new Date() });
      return { success: true } as const;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const session = await getAuthorizedSession(ctx.user, input.id); await assertCirclePermission(ctx.user, session.circleId, "attendance.edit"); return softDeleteSession(input.id); }),
  }),

  // ===================== ATTENDANCE =====================
  attendance: router({
    bySession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ ctx, input }) => { await getAuthorizedSession(ctx.user, input.sessionId); return getAttendanceBySession(input.sessionId); }),
    markUnrecordedPresent: protectedProcedure.input(z.object({ sessionId: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await getAuthorizedSession(ctx.user, input.sessionId);
      await assertCirclePermission(ctx.user, session.circleId, "attendance.edit");
      const circleStudents = await getStudents(undefined, session.circleId);
      return markUnrecordedAttendancePresent(session.id, circleStudents.filter((student) => student.isActive).map((student) => student.id), ctx.user.id);
    }),
    upsert: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        studentId: z.number(),
        status: z.enum(["present", "absent", "late", "excused"]),
        notes: z.string().optional(),
        recordedBy: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { session } = await assertSessionStudentMatch(ctx.user, input.sessionId, input.studentId);
        await assertCirclePermission(ctx.user, session.circleId, "attendance.edit");
        return upsertAttendance({ ...input, recordedBy: ctx.user.id });
      }),
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
};
