/** موجّهات tRPC: أكواد الدخول والعضويات والصلاحيات. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";
import { GRANULAR_PERMISSIONS } from "../../shared/permissions";
import { assertCanDelegate, assertPermission, assertScope, getAuthorization, ROLE_PERMISSION_TEMPLATES } from "../accessControl";

import { createAccessCodeSecret, getAccessCodeHint, hashAccessCode } from "../accessCodeSecurity";

import { protectedProcedure, router } from "../_core/trpc";

import {
  createAccessCode,
  createAuditLog,
  createCenterMembership,
  createPermissionGrants,
  createUserScopes,
  getAuditLogForCenter,
  getCenterMemberById,
  getCenterMembers,
  getCenterIdForCircle,
  getCenterIdForStudent,
  getCircleById,
  getUserCenterMemberships,
  revokeAccessCode,
  revokeUserPermissionGrants,
  revokeUserScopes,
  updateCenterMembership,
  getAccessCodeById,
  getAccessCodesForCenter,
  redeemAccessCodeSecure,
} from "../db";

export const accessRouters = {

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
        const isReaderCode = input.role === "student" || input.role === "guardian";
        const isGuideCode = input.role === "guide";
        if (input.expiresAt && input.expiresAt <= new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ الانتهاء يجب أن يكون في المستقبل" });
        if (input.role === "supervisor" && !auth.membership.isOwner) throw new TRPCError({ code: "FORBIDDEN", message: "إنشاء كود مشرف من صلاحية مالك المركز فقط" });
        if (isTeacherCode && !input.circleId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم ربط كود المعلم بحلقة واحدة محددة" });
        if (isTeacherCode && input.maxUses !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "كود المعلم مخصص لمعلم واحد واستخدام واحد فقط" });
        if (isReaderCode && !input.studentId) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم ربط كود الطالب أو ولي الأمر بطالب محدد" });
        if (isReaderCode && input.maxUses !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "كود الطالب أو ولي الأمر مخصص لحساب واحد واستخدام واحد فقط" });
        if (["teacher", "assistant_teacher", "student", "guardian", "guide"].includes(input.role) && input.scopes.some((scope) => scope.scopeType === "center")) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يجوز منح هذا الدور نطاق المركز كاملاً" });
        if (input.circleId && await getCenterIdForCircle(input.circleId) !== input.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "الحلقة لا تنتمي إلى المركز المحدد" });
        if (input.studentId && await getCenterIdForStudent(input.studentId) !== input.centerId) throw new TRPCError({ code: "BAD_REQUEST", message: "الطالب لا ينتمي إلى المركز المحدد" });
        const guideCircleIds = Array.from(new Set(input.scopes.filter((scope) => scope.scopeType === "circle" && typeof scope.scopeId === "number").map((scope) => scope.scopeId!)));
        if (isGuideCode && (guideCircleIds.length === 0 || guideCircleIds.length !== input.scopes.length)) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم تحديد حلقة واحدة أو أكثر للموجّه ولا يقبل كود الموجّه نطاقات أخرى" });
        if (isGuideCode && input.maxUses !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "كود الموجّه مخصص لحساب واحد واستخدام واحد فقط" });
        if (isGuideCode && (await Promise.all(guideCircleIds.map(getCenterIdForCircle))).some((centerId) => centerId !== input.centerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "كل حلقات الموجّه يجب أن تنتمي إلى المركز المحدد" });
        const codeScopes = isTeacherCode
          ? [{ scopeType: "circle" as const, scopeId: input.circleId! }]
          : isReaderCode
            ? [{ scopeType: "student" as const, scopeId: input.studentId! }]
            : isGuideCode
              ? guideCircleIds.map((scopeId) => ({ scopeType: "circle" as const, scopeId }))
              : input.scopes;
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
        const id = await createAccessCode({ centerId: input.centerId, codeHash, codeHint: hint, role: input.role, scopeJson: JSON.stringify(codeScopes), circleId: isTeacherCode ? input.circleId : undefined, teacherId: isTeacherCode ? input.teacherId : undefined, studentId: isReaderCode ? input.studentId : undefined, guardianUserId: isReaderCode ? input.guardianUserId : undefined, createdBy: ctx.user.id, expiresAt: input.expiresAt, maxUses: isTeacherCode || isReaderCode || isGuideCode ? 1 : input.maxUses });
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
      reissue: protectedProcedure.input(z.object({ id: z.number(), expiresAt: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
        const previous = await getAccessCodeById(input.id);
        if (!previous) throw new TRPCError({ code: "NOT_FOUND", message: "الكود غير موجود" });
        await assertPermission(ctx.user, previous.centerId, "access_codes.create");
        if (previous.circleId) await assertScope(ctx.user, previous.centerId, { circleId: previous.circleId });
        if (previous.studentId) await assertScope(ctx.user, previous.centerId, { studentId: previous.studentId });
        const rawCode = createAccessCodeSecret();
        const hint = getAccessCodeHint(rawCode);
        if (input.expiresAt && input.expiresAt <= new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ الانتهاء يجب أن يكون في المستقبل" });
        const expiresAt = input.expiresAt === undefined ? previous.expiresAt ?? undefined : input.expiresAt ?? undefined;
        const id = await createAccessCode({ centerId: previous.centerId, codeHash: hashAccessCode(rawCode), codeHint: hint, role: previous.role, scopeJson: previous.scopeJson, circleId: previous.circleId, teacherId: previous.teacherId, studentId: previous.studentId, guardianUserId: previous.guardianUserId, createdBy: ctx.user.id, expiresAt, maxUses: previous.maxUses });
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
};
