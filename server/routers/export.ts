import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { generateMemorizationExcel, generateAttendanceExcel } from '../export/excel';
import { generateMemorizationPDF, generateAttendancePDF } from '../export/pdf';
import { eq, and, gte, lte } from 'drizzle-orm';
import {
  sessions,
  memorization,
  attendance,
  students,
  circles,
  centers,
  branches,
} from '../../drizzle/schema';

export const exportRouter = router({
  /**
   * تصدير تقرير الحفظ إلى Excel أو PDF
   */
  memorizationReport: protectedProcedure
    .input(
      z.object({
        circleId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        format: z.enum(['excel', 'pdf']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // التحقق من صلاحيات المستخدم
      if (
        ctx.user.role !== 'super_admin' &&
        ctx.user.role !== 'org_admin' &&
        ctx.user.role !== 'center_manager' &&
        ctx.user.role !== 'teacher'
      ) {
        throw new Error('Unauthorized');
      }

      // جلب بيانات الحلقة
      const circleData = await db
        .select()
        .from(circles)
        .where(eq(circles.id, input.circleId))
        .limit(1);

      const circle = circleData[0];
      if (!circle) throw new Error('Circle not found');

      // جلب بيانات الفرع
      const branchData = circle.branchId
        ? await db
            .select()
            .from(branches)
            .where(eq(branches.id, circle.branchId))
            .limit(1)
        : [];

      const branch = branchData[0];

      // جلب بيانات المركز
      const centerData = branch?.centerId
        ? await db
            .select()
            .from(centers)
            .where(eq(centers.id, branch.centerId))
            .limit(1)
        : [];

      const centerInfo = centerData[0];

      // جلب بيانات الحفظ
      const memData = await db
        .select({
          studentId: students.id,
          studentName: students.name,
          surahNumber: memorization.surahNumber,
          fromAyah: memorization.fromAyah,
          toAyah: memorization.toAyah,
          grade: memorization.grade,
          date: memorization.createdAt,
          notes: memorization.notes,
        })
        .from(memorization)
        .innerJoin(students, eq(memorization.studentId, students.id))
        .innerJoin(sessions, eq(memorization.sessionId, sessions.id))
        .where(
          input.startDate && input.endDate
            ? and(
                eq(sessions.circleId, input.circleId),
                gte(memorization.createdAt, new Date(input.startDate)),
                lte(memorization.createdAt, new Date(input.endDate))
              )
            : eq(sessions.circleId, input.circleId)
        );

      // تحويل البيانات إلى الصيغة المطلوبة
      const formattedData = memData.map((row) => ({
        studentName: row.studentName || 'غير معروف',
        surahName: `السورة ${row.surahNumber} (من الآية ${row.fromAyah} إلى ${row.toAyah})`,
        versesCount: (row.toAyah - row.fromAyah) + 1,
        quality: row.grade || '',
        date: row.date ? new Date(row.date).toLocaleDateString('ar-SA') : '',
        notes: row.notes || '',
      }));

      let buffer: Buffer;

      if (input.format === 'excel') {
        buffer = generateMemorizationExcel(
          formattedData,
          centerInfo?.name || 'المركز',
          circle.name || 'الحلقة'
        );
      } else {
        buffer = await generateMemorizationPDF(
          formattedData,
          centerInfo?.name || 'المركز',
          circle.name || 'الحلقة'
        );
      }

      return {
        data: buffer.toString('base64'),
        filename: `تقرير_الحفظ_${circle.name}_${new Date().getTime()}.${input.format === 'excel' ? 'xlsx' : 'pdf'}`,
        contentType:
          input.format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
      };
    }),

  /**
   * تصدير تقرير الحضور والغياب إلى Excel أو PDF
   */
  attendanceReport: protectedProcedure
    .input(
      z.object({
        circleId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        format: z.enum(['excel', 'pdf']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // التحقق من صلاحيات المستخدم
      if (
        ctx.user.role !== 'super_admin' &&
        ctx.user.role !== 'org_admin' &&
        ctx.user.role !== 'center_manager' &&
        ctx.user.role !== 'teacher'
      ) {
        throw new Error('Unauthorized');
      }

      // جلب بيانات الحلقة
      const circleData = await db
        .select()
        .from(circles)
        .where(eq(circles.id, input.circleId))
        .limit(1);

      const circle = circleData[0];
      if (!circle) throw new Error('Circle not found');

      // جلب بيانات الفرع
      const branchData = circle.branchId
        ? await db
            .select()
            .from(branches)
            .where(eq(branches.id, circle.branchId))
            .limit(1)
        : [];

      const branch = branchData[0];

      // جلب بيانات المركز
      const centerData = branch?.centerId
        ? await db
            .select()
            .from(centers)
            .where(eq(centers.id, branch.centerId))
            .limit(1)
        : [];

      const centerInfo = centerData[0];

      // جلب بيانات الحضور
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      const attData = await db
        .select({
          studentName: students.name,
          sessionDate: sessions.scheduledAt,
          status: attendance.status,
          sessionType: sessions.type,
          circleName: circles.name,
        })
        .from(attendance)
        .innerJoin(students, eq(attendance.studentId, students.id))
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .innerJoin(circles, eq(sessions.circleId, circles.id))
        .where(
          and(
            eq(sessions.circleId, input.circleId),
            gte(sessions.scheduledAt, startDate),
            lte(sessions.scheduledAt, endDate)
          )
        );

      // تحويل البيانات إلى الصيغة المطلوبة
      const formattedData = attData.map((row) => ({
        studentName: row.studentName || 'غير معروف',
        sessionDate: row.sessionDate
          ? new Date(row.sessionDate).toLocaleDateString('ar-SA')
          : '',
        status: row.status || '',
        sessionType: row.sessionType || '',
        circle: row.circleName || '',
      }));

      let buffer: Buffer;

      if (input.format === 'excel') {
        buffer = generateAttendanceExcel(
          formattedData,
          centerInfo?.name || 'المركز',
          input.startDate,
          input.endDate
        );
      } else {
        buffer = await generateAttendancePDF(
          formattedData,
          centerInfo?.name || 'المركز',
          input.startDate,
          input.endDate
        );
      }

      return {
        data: buffer.toString('base64'),
        filename: `تقرير_الحضور_${circle.name}_${new Date().getTime()}.${input.format === 'excel' ? 'xlsx' : 'pdf'}`,
        contentType:
          input.format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
      };
    }),

  /**
   * تصدير تقرير الطلاب إلى Excel أو PDF
   */
  studentsReport: protectedProcedure
    .input(
      z.object({
        circleId: z.number(),
        format: z.enum(['excel', 'pdf']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // التحقق من صلاحيات المستخدم
      if (
        ctx.user.role !== 'super_admin' &&
        ctx.user.role !== 'org_admin' &&
        ctx.user.role !== 'center_manager' &&
        ctx.user.role !== 'teacher'
      ) {
        throw new Error('Unauthorized');
      }

      // جلب بيانات الحلقة
      const circleData = await db
        .select()
        .from(circles)
        .where(eq(circles.id, input.circleId))
        .limit(1);

      const circle = circleData[0];
      if (!circle) throw new Error('Circle not found');

      // جلب بيانات الفرع
      const branchData = circle.branchId
        ? await db
            .select()
            .from(branches)
            .where(eq(branches.id, circle.branchId))
            .limit(1)
        : [];

      const branch = branchData[0];

      // جلب بيانات المركز
      const centerData = branch?.centerId
        ? await db
            .select()
            .from(centers)
            .where(eq(centers.id, branch.centerId))
            .limit(1)
        : [];

      const centerInfo = centerData[0];

      // جلب بيانات الطلاب
      const studentData = await db
        .select({
          name: students.name,
          phone: students.phone,
          guardianName: students.guardianName,
          enrollmentDate: students.enrollmentDate,
          isActive: students.isActive,
        })
        .from(students)
        .where(eq(students.circleId, input.circleId));

      const formattedData = studentData.map((row) => ({
        name: row.name || 'غير معروف',
        email: row.phone || '',
        phone: row.guardianName || '',
        enrollmentDate: row.enrollmentDate
          ? new Date(row.enrollmentDate).toLocaleDateString('ar-SA')
          : '',
        status: row.isActive ? 'نشط' : 'غير نشط',
      }));

      let buffer: Buffer;

      if (input.format === 'excel') {
        const { generateStudentsReportExcel } = await import('../export/excel');
        buffer = generateStudentsReportExcel(formattedData, centerInfo?.name || 'المركز');
      } else {
        buffer = await generateAttendancePDF(
          formattedData as any,
          centerInfo?.name || 'المركز',
          '',
          ''
        );
      }

      return {
        data: buffer.toString('base64'),
        filename: `تقرير_الطلاب_${circle.name}_${new Date().getTime()}.${input.format === 'excel' ? 'xlsx' : 'pdf'}`,
        contentType:
          input.format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
      };
    }),
});
