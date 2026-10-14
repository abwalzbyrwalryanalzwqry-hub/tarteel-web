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
  getCenterIdForCircle,
  getCircleById,
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
import { autoLinkGuardianByPhone, normalizeGuardianPhone } from "../data/guardian-links";
import { assertStudentManageAccess, assertStudentReadAccess, getAccessibleCenterIds, getTeacherCircleScope, listReadableStudents, toReaderStudent } from "./_shared";

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
        /** اختياري: إن كان للمستخدم مركز واحد يُستخدم تلقائياً. */
        centerId: z.number().optional(),
        name: z.string().min(2),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        nationalId: z.string().optional(),
        specialization: z.string().optional(),
        qualification: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let centerId = input.centerId;
        if (!centerId) {
          const centerIds = await getAccessibleCenterIds(ctx.user, "teachers.create");
          if (centerIds.length !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: centerIds.length ? "اختر مركز المعلم" : "لا يوجد مركز يمكنك إضافة معلم إليه" });
          centerId = centerIds[0];
        }
        await assertPermission(ctx.user, centerId, "teachers.create");
        return createTeacher({ ...input, centerId });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        nationalId: z.string().optional(),
        specialization: z.string().optional(),
        qualification: z.string().optional(),
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
      if (circle.centerId !== teacher.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن نقل المعلم إلى حَلَقة خارج مركزه" });
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
      .query(({ ctx, input }) => listReadableStudents(ctx.user, input)),
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
        // دون حلقة: المركز المحدد، أو مركز المستخدم الوحيد تلقائياً.
        let centerId = circleCenterId ?? input.centerId;
        if (!centerId && !input.circleId) {
          const centerIds = await getAccessibleCenterIds(ctx.user, "students.create");
          if (centerIds.length === 1) centerId = centerIds[0];
        }
        await assertStudentManageAccess(ctx.user, input.circleId, "students.create", centerId);
        if (!centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم تحديد المركز للطالب غير المرتبط بحلقة" });
        const guardianPhone = normalizeGuardianPhone(input.guardianPhone);
        const created = await createStudent({ ...input, guardianPhone, centerId });
        await autoLinkGuardianByPhone(guardianPhone, centerId, ctx.user.id);
        return created;
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
        const guardianPhone = normalizeGuardianPhone(data.guardianPhone);
        await updateStudent(id, { ...data, guardianPhone });
        if (student && guardianPhone !== undefined && guardianPhone !== student.guardianPhone) await autoLinkGuardianByPhone(guardianPhone, student.centerId, ctx.user.id);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => { const student = await getStudentById(input.id); await assertStudentManageAccess(ctx.user, student?.circleId, "students.delete", student?.centerId); return softDeleteStudent(input.id); }),
  }),
};
