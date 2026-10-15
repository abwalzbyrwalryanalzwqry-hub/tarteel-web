/**
 * موجّه السجل اليومي والتقارير (daily.*): نظير نداءات زِن (daily_record_sheet وopen_daily_record …
 * halaqa_report_data وreport_identity) بالأسماء والأشكال التي تستعملها الشاشات المنقولة في
 * client/src/mushaf/lib/daily-record-api.ts وreports/api.ts.
 *
 * الصلاحية: القراءة لمن يرى حضور الحلقة (attendance.view)، والكتابة لمن يسجّله (attendance.create) في
 * نطاقه — المعلم في حلقته، والإدارة في كل حلقات مركزها — والاعتماد لمدير المركز (center.edit).
 * أخطاء المجال تصل برسالة هي رمزها (VERSION_CONFLICT…) فتعرض الشاشة نصها العربي.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  assertCirclePermission,
  assertPermission,
  type AccessSubject,
} from "../accessControl";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createNotification,
  getCircles,
  getStudentById,
  getTeacherByUserId,
} from "../db";
import {
  DailyError,
  clearDailyAttendance,
  completeDailyRecord,
  dailyHistory,
  dailyReportData,
  dailySheet,
  dailyTrashList,
  dailyWeek,
  deleteDailyRecord,
  getDailyCircle,
  getDailyRecordById,
  getDailyTrash,
  getReportIdentity,
  lockDailyRecord,
  openDailyRecord,
  reopenDailyRecord,
  restoreDailyRecord,
  saveDailyEntry,
  setDailyAttendance,
  setDailyAttendanceBulk,
  setDailyNotes,
  setReportIdentity,
  studentDailyDays,
  studentDailyOverview,
  studentsLastMemorize,
} from "../data/daily-record";
import { DAILY_ATTENDANCE, isDayKey } from "../../shared/dailyRecord";
import { assertStudentReadAccess, listReadableStudents } from "./_shared";

const id = z.coerce.number().int().positive();
const day = z.string().refine(isDayKey, "INVALID_DATE");
const version = z.number().int().min(0);
const segment = z.object({
  surah_name: z.string().max(40),
  from_ayah: z.number().int(),
  to_ayah: z.number().int(),
});
const work = z
  .object({
    segments: z.array(segment).max(60),
    grade: z.number().int(),
    error_type: z.string().max(16).nullish(),
    notes: z.string().max(1000).nullish(),
    direction: z.enum(["forward", "backward"]).nullish(),
  })
  .nullable();
const score = z.number().int().nullable();

const CODE: Partial<Record<string, TRPCError["code"]>> = {
  NOT_YOUR_HALAQA: "FORBIDDEN",
  FORBIDDEN: "FORBIDDEN",
  VERSION_CONFLICT: "CONFLICT",
  RECORD_EXISTS: "CONFLICT",
  RECORD_NOT_FOUND: "NOT_FOUND",
  NOT_FOUND: "NOT_FOUND",
};

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DailyError)
      throw new TRPCError({
        code: CODE[error.code] ?? "BAD_REQUEST",
        message: error.code,
        cause: error,
      });
    throw error;
  }
}

const allowed = async (check: () => Promise<unknown>) => {
  try {
    await check();
    return true;
  } catch {
    return false;
  }
};

/** الحلقة وصلاحيات المستخدم فيها؛ من لا يراها يُرفض بـ NOT_YOUR_HALAQA. */
async function circleAccess(user: AccessSubject, circleId: number) {
  const circle = await getDailyCircle(circleId);
  if (!circle) throw new DailyError("NOT_YOUR_HALAQA");
  if (
    !(await allowed(() =>
      assertCirclePermission(user, circleId, "attendance.view")
    ))
  )
    throw new DailyError("NOT_YOUR_HALAQA");
  const [editor, canLock] = await Promise.all([
    allowed(() => assertCirclePermission(user, circleId, "attendance.create")),
    allowed(() => assertPermission(user, circle.centerId, "center.edit")),
  ]);
  return { circle, editor, canLock };
}

async function editableCircle(user: AccessSubject, circleId: number) {
  const access = await circleAccess(user, circleId);
  if (!access.editor) throw new DailyError("NOT_YOUR_HALAQA");
  return access;
}

/** التقارير: من يرى الحلقة ويملك استخراج تقاريرها (reports.export) داخل نطاقها. */
async function reportAccess(user: AccessSubject, circleId: number) {
  const access = await circleAccess(user, circleId);
  if (
    !(await allowed(() =>
      assertCirclePermission(user, circleId, "reports.export")
    ))
  )
    throw new DailyError("FORBIDDEN");
  return access;
}

/** سجل للكتابة: موجود، وفي حلقة يديرها المستخدم. */
async function writableRecord(user: AccessSubject, recordId: number) {
  const rec = await getDailyRecordById(recordId);
  if (!rec) throw new DailyError("RECORD_NOT_FOUND");
  const access = await editableCircle(user, rec.circleId);
  return { rec, ...access };
}

export const dailyRouter = router({
  /**
   * حلقات السجل اليومي: كل حلقة نشطة يرى المستخدم حضورها، وteacher_id هو المستخدم نفسه في حلقاته
   * (معلماً أو مساعداً) فتظهر أولاً كما في زِن.
   */
  halaqat: protectedProcedure.query(async ({ ctx }) => {
    const teacher = await getTeacherByUserId(ctx.user.id).catch(
      () => undefined
    );
    const all = (await getCircles()).filter(c => c.isActive);
    const visible = await Promise.all(
      all.map(c =>
        allowed(() => assertCirclePermission(ctx.user, c.id, "attendance.view"))
      )
    );
    return all
      .filter((_, i) => visible[i])
      .map(c => ({
        id: String(c.id),
        center_id: String(c.centerId),
        name: c.name,
        teacher_id:
          teacher &&
          (c.teacherId === teacher.id || c.assistantTeacherId === teacher.id)
            ? String(ctx.user.id)
            : null,
        schedule: c.schedule ?? null,
        created_at: new Date(c.createdAt).toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }),

  sheet: protectedProcedure
    .input(z.object({ halaqa: id, date: day }))
    .query(({ ctx, input }) =>
      run(async () => {
        const { circle, editor, canLock } = await circleAccess(
          ctx.user,
          input.halaqa
        );
        return dailySheet(circle, input.date, { editor, canLock });
      })
    ),

  /** يحدد الحلقة والتاريخ من رقم السجل (روابط الإشعارات). */
  locate: protectedProcedure
    .input(z.object({ record: id }))
    .query(({ ctx, input }) =>
      run(async () => {
        const rec = await getDailyRecordById(input.record);
        if (!rec) throw new DailyError("RECORD_NOT_FOUND");
        await circleAccess(ctx.user, rec.circleId);
        return { halaqa: String(rec.circleId), date: rec.recordDate };
      })
    ),

  week: protectedProcedure
    .input(z.object({ halaqa: id, to: day }))
    .query(({ ctx, input }) =>
      run(async () => {
        await circleAccess(ctx.user, input.halaqa);
        return dailyWeek(input.halaqa, input.to);
      })
    ),

  open: protectedProcedure
    .input(z.object({ halaqa: id, date: day }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await editableCircle(ctx.user, input.halaqa);
        return openDailyRecord(input.halaqa, input.date, ctx.user.id);
      })
    ),

  setAttendance: protectedProcedure
    .input(
      z.object({
        record: id,
        student: id,
        status: z.enum(DAILY_ATTENDANCE),
        reason: z.string().max(300).nullable(),
        version,
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await writableRecord(ctx.user, input.record);
        return setDailyAttendance(
          input.record,
          input.student,
          input.status,
          input.reason,
          input.version,
          ctx.user.id
        );
      })
    ),

  clearAttendance: protectedProcedure
    .input(z.object({ record: id, student: id, version }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await writableRecord(ctx.user, input.record);
        return clearDailyAttendance(
          input.record,
          input.student,
          input.version,
          ctx.user.id
        );
      })
    ),

  setAttendanceBulk: protectedProcedure
    .input(
      z.object({
        record: id,
        rows: z
          .array(
            z.object({
              student: id,
              status: z.enum(DAILY_ATTENDANCE).nullable(),
              version,
            })
          )
          .max(300),
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await writableRecord(ctx.user, input.record);
        return setDailyAttendanceBulk(input.record, input.rows, ctx.user.id);
      })
    ),

  saveEntry: protectedProcedure
    .input(
      z.object({
        record: id,
        student: id,
        version,
        payload: z.object({
          memorize: work.optional(),
          review: work.optional(),
          evaluation: z
            .object({
              overall: score.optional(),
              tajweed: score.optional(),
              pronunciation: score.optional(),
              behavior: score.optional(),
            })
            .nullable()
            .optional(),
          note: z.string().max(1000).nullable().optional(),
        }),
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await writableRecord(ctx.user, input.record);
        return saveDailyEntry(
          input.record,
          input.student,
          input.payload,
          input.version,
          ctx.user.id
        );
      })
    ),

  setNotes: protectedProcedure
    .input(
      z.object({ record: id, notes: z.string().max(2000).nullable(), version })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        await writableRecord(ctx.user, input.record);
        return setDailyNotes(input.record, input.notes, input.version);
      })
    ),

  complete: protectedProcedure
    .input(z.object({ record: id, version }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        const { circle } = await writableRecord(ctx.user, input.record);
        const out = await completeDailyRecord(
          input.record,
          input.version,
          ctx.user.id
        );
        // إشعار مدير المركز باكتمال سجل اليوم (كما في زِن)، إن لم يكن هو من أكمله.
        if (circle.centerManagerId && circle.centerManagerId !== ctx.user.id) {
          const rec = await getDailyRecordById(input.record);
          await createNotification({
            userId: circle.centerManagerId,
            title: "اكتمل السجل اليومي",
            message: `${circle.name} — ${rec?.recordDate ?? ""}`,
            type: "attendance",
            relatedId: input.record,
            relatedType: "daily_record",
          }).catch(() => undefined);
        }
        return out;
      })
    ),

  reopen: protectedProcedure
    .input(z.object({ record: id, version }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await writableRecord(ctx.user, input.record);
        return reopenDailyRecord(input.record, input.version);
      })
    ),

  lock: protectedProcedure
    .input(z.object({ record: id, version }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        const rec = await getDailyRecordById(input.record);
        if (!rec) throw new DailyError("RECORD_NOT_FOUND");
        const { canLock } = await circleAccess(ctx.user, rec.circleId);
        if (!canLock) throw new DailyError("FORBIDDEN");
        return lockDailyRecord(input.record, input.version, ctx.user.id);
      })
    ),

  history: protectedProcedure
    .input(
      z.object({
        halaqa: id,
        before: day.nullish(),
        limit: z.number().int().min(1).max(60).optional(),
      })
    )
    .query(({ ctx, input }) =>
      run(async () => {
        const { editor } = await circleAccess(ctx.user, input.halaqa);
        return dailyHistory(
          input.halaqa,
          input.before ?? null,
          input.limit ?? 30,
          editor
        );
      })
    ),

  delete: protectedProcedure
    .input(z.object({ record: id, version }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        await writableRecord(ctx.user, input.record);
        return deleteDailyRecord(input.record, input.version, ctx.user.id);
      })
    ),

  trashList: protectedProcedure
    .input(z.object({ halaqa: id }))
    .query(({ ctx, input }) =>
      run(async () => {
        await editableCircle(ctx.user, input.halaqa);
        return dailyTrashList(input.halaqa);
      })
    ),

  restore: protectedProcedure
    .input(z.object({ trash: id }))
    .mutation(({ ctx, input }) =>
      run(async () => {
        const t = await getDailyTrash(input.trash);
        if (!t) throw new DailyError("NOT_FOUND");
        await editableCircle(ctx.user, t.circleId);
        return restoreDailyRecord(input.trash);
      })
    ),

  /** آخر حفظ مسجّل لكل طالب يقرؤه المستخدم (قائمة الطلاب)، بالمرشحات نفسها لـ students.list. */
  lastMemorize: protectedProcedure
    .input(
      z
        .object({ centerId: z.number().optional(), circleId: z.number().optional() })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const readable = await listReadableStudents(ctx.user, input ?? {});
      return studentsLastMemorize(readable.map(student => student.id));
    }),

  studentOverview: protectedProcedure
    .input(z.object({ student: id }))
    .query(async ({ ctx, input }) => {
      await assertStudentReadAccess(
        ctx.user,
        await getStudentById(input.student)
      );
      return studentDailyOverview(input.student);
    }),

  /** أيام الطالب في السجل اليومي (ملف الطالب): الأحدث أولاً. */
  studentDays: protectedProcedure
    .input(
      z.object({
        student: id,
        limit: z.number().int().min(1).max(400).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertStudentReadAccess(
        ctx.user,
        await getStudentById(input.student)
      );
      return studentDailyDays(input.student, input.limit ?? 60);
    }),

  reportData: protectedProcedure
    .input(
      z.object({
        halaqa: id,
        from: day,
        to: day,
        students: z.array(id).max(300).nullish(),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7).nullish(),
        history: z.boolean().optional(),
      })
    )
    .query(({ ctx, input }) =>
      run(async () => {
        const { circle } = await reportAccess(ctx.user, input.halaqa);
        return dailyReportData(circle, input);
      })
    ),

  reportIdentity: protectedProcedure
    .input(z.object({ halaqa: id }))
    .query(({ ctx, input }) =>
      run(async () => {
        const { circle, canLock } = await reportAccess(ctx.user, input.halaqa);
        return {
          identity: await getReportIdentity(circle.centerId),
          can_edit: canLock,
        };
      })
    ),

  setReportIdentity: protectedProcedure
    .input(
      z.object({
        halaqa: id,
        identity: z.record(z.string(), z.unknown()).nullable(),
      })
    )
    .mutation(({ ctx, input }) =>
      run(async () => {
        const { circle, canLock } = await reportAccess(ctx.user, input.halaqa);
        if (!canLock) throw new DailyError("FORBIDDEN");
        await setReportIdentity(circle.centerId, input.identity);
        return { ok: true } as const;
      })
    ),
});
