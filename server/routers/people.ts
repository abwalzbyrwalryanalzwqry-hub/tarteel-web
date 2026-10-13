/** موجّهات tRPC: المعلمون ودعواتهم والطلاب. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";

import { assertCirclePermission, assertPermission, assertScope, assertStudentPermission } from "../accessControl";

import { protectedProcedure, router } from "../_core/trpc";

import {
  createStudent,
  createTeacher,
  createTeacherInvite,
  redeemTeacherInvite,
  getBranchById,
  getCenterIdForCircle,
  getCircleById,
  getMemorizationByStudent,
  getStudentById,
  getStudentByUserId,
  getStudentsByGuardianUserId,
  getStudents,
  getTeacherById,
  getTeacherInviteById,
  getTeacherInvites,
  getTeacherLastActivity,
  getTeachers,
  revokeTeacherInvite,
  softDeleteStudent,
  softDeleteTeacher,
  transferTeacherToCircle,
  updateStudent,
  updateTeacher,
} from "../db";
import { assertStudentManageAccess, assertStudentReadAccess, getAccessibleCenterIds, getTeacherCircleScope, toReaderStudent } from "./_shared";

export const peopleRouters = {

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
          return [toReaderStudent(student)];
        }
        if (ctx.user.role === "guardian") {
          const linked = await getStudentsByGuardianUserId(ctx.user.id);
          const permitted = await Promise.all(linked.map(async (student) => { try { await assertStudentReadAccess(ctx.user, student); return student; } catch { return null; } }));
          return permitted.filter((student): student is NonNullable<typeof student> => Boolean(student)).map(toReaderStudent);
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
      const authorizedStudent = await assertStudentReadAccess(ctx.user, student);
      return ctx.user.role === "student" || ctx.user.role === "guardian" ? toReaderStudent(authorizedStudent) : authorizedStudent;
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
};
