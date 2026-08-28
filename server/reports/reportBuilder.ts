import { and, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { getDb, getReportingGoals, getReportingPreferences, keepLatestAttendanceRows } from "../db";
import { attendance, branches, centers, circles, evaluation, memorization, revision, sessions, students, teachers } from "../../drizzle/schema";
import { GRADE_LABELS, QURAN_SURAHS } from "../../shared/types";
import { scoreToStars, MIZAN_RATING_LABELS } from "../../shared/mizan";

export type ReportType = "circle" | "student" | "attendance" | "progress" | "comprehensive";
export type ReportSort = "alphabetical" | "enrollment" | "performance" | "attendance";
export type ReportSections = { summary: boolean; attendance: boolean; memorization: boolean; revision: boolean; evaluations: boolean };
export type ReportBuilderInput = { circleId: number; startDate?: Date; endDate?: Date; studentIds?: number[]; reportType: ReportType; sortBy: ReportSort; sections: ReportSections };

export type ReportActivity = { id: number; kind: "memorization" | "revision"; from: string; to: string; pages: number | null; grade: string | null; date: Date; notes: string | null };
export type StudentReportBlock = {
  student: { id: number; name: string; enrollmentDate: Date | null };
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  memorization: ReportActivity[];
  revision: ReportActivity[];
  averageScore: number | null;
  evaluations: { id: number; score: number | null; rating: string; date: Date; notes: string | null }[];
};
export type UnifiedReport = {
  meta: { title: string; typeLabel: string; circleName: string; centerName: string; startDate: Date | null; endDate: Date | null; generatedAt: Date };
  sections: ReportSections;
  summary: { students: number; present: number; absent: number; late: number; excused: number; attendanceRate: number; memorizationCount: number; revisionCount: number; averageScore: number | null };
  students: StudentReportBlock[];
};

export type ExecutiveCircleReport = {
  meta: { circleId: number; circleName: string; startDate: Date; endDate: Date; period: "weekly" | "monthly" };
  summary: { sessions: number; present: number; absent: number; late: number; excused: number; attendanceRate: number; memorizationEntries: number; revisionEntries: number; memorizedPages: number; reviewedPages: number };
  buckets: { key: string; label: string; sessions: number; present: number; absent: number; late: number; excused: number; memorizationEntries: number; revisionEntries: number; memorizedPages: number; reviewedPages: number }[];
};

export type CenterManagementReport = {
  meta: { centerId: number; centerName: string; startDate: Date; endDate: Date; period: "weekly" | "monthly"; days: number; filters: { teacherId: number | null; teacherName: string | null; ageGroup: StudentAgeGroup | null }; branding: { headerTitle: string | null; footerText: string | null; logoUrl: string | null; logoKey: string | null; teacherMessageTemplate: string | null } };
  summary: { sessions: number; present: number; absent: number; late: number; excused: number; attendanceRate: number; memorizedPages: number; reviewedPages: number; memorizationEntries: number; revisionEntries: number; activeCircles: number; activeStudents: number; studentsWithMemorization: number; studentsWithRevision: number; studentsWithRecordedProgress: number; studentsWithoutRecordedProgress: number };
  goals: { attendanceTarget: number | null; memorizedPagesTarget: number | null; reviewedPagesTarget: number | null; projectedMemorizedPagesTarget: number | null; projectedReviewedPagesTarget: number | null };
  comparisons: { circleId: number; circleName: string; teacherName: string | null; teacherPhone: string | null; teacherEmail: string | null; sessions: number; attendanceRate: number; memorizedPages: number; reviewedPages: number; activityEntries: number; activeStudents: number; studentsWithRecordedProgress: number; progressCoverageRate: number }[];
  trend: { key: string; label: string; sessions: number; attendanceRate: number; memorizedPages: number; reviewedPages: number }[];
  alerts: { id: string; severity: "warning" | "attention"; title: string; description: string; circleId?: number; teacherName?: string | null; teacherPhone?: string | null; teacherEmail?: string | null }[];
};

export type StudentAgeGroup = "under_10" | "10_13" | "14_17" | "18_plus";

export const AGE_GROUP_LABELS: Record<StudentAgeGroup, string> = { under_10: "دون 10 سنوات", "10_13": "10–13 سنة", "14_17": "14–17 سنة", "18_plus": "18 سنة فأكثر" };

function asDateBoundary(value: Date | undefined, end = false) {
  if (!value) return undefined;
  const boundary = new Date(value);
  if (end) boundary.setHours(23, 59, 59, 999); else boundary.setHours(0, 0, 0, 0);
  return boundary;
}

function getSurahName(number: number) { return QURAN_SURAHS.find((surah) => surah.number === number)?.name ?? `سورة ${number}`; }
function location(fromSurah: number, fromAyah: number) { return `${getSurahName(fromSurah)} · آية ${fromAyah}`; }
function typeLabel(type: ReportType) { return ({ circle: "تقرير متابعة الحلقة", student: "تقرير الطلاب", attendance: "تقرير الحضور", progress: "تقرير الحفظ والمراجعة", comprehensive: "تقرير شامل" } as const)[type]; }

export async function buildUnifiedReport(input: ReportBuilderInput): Promise<UnifiedReport> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [circle] = await db.select().from(circles).where(eq(circles.id, input.circleId)).limit(1);
  if (!circle) throw new Error("الحلقة غير موجودة");
  const [branch] = await db.select().from(branches).where(eq(branches.id, circle.branchId)).limit(1);
  const [center] = branch ? await db.select().from(centers).where(eq(centers.id, branch.centerId)).limit(1) : [];
  const start = asDateBoundary(input.startDate);
  const end = asDateBoundary(input.endDate, true);
  const sessionConditions = [eq(sessions.circleId, input.circleId), ne(sessions.status, "draft")];
  if (start) sessionConditions.push(gte(sessions.scheduledAt, start));
  if (end) sessionConditions.push(lte(sessions.scheduledAt, end));
  const circleSessions = await db.select().from(sessions).where(and(...sessionConditions));
  const sessionIds = circleSessions.map((session) => session.id);
  const studentConditions = [eq(students.circleId, input.circleId)];
  if (input.studentIds?.length) studentConditions.push(inArray(students.id, input.studentIds));
  const reportStudents = await db.select().from(students).where(and(...studentConditions));
  const studentIds = reportStudents.map((student) => student.id);
  const [attendanceRows, memorizationRows, revisionRows, evaluationRows] = await Promise.all([
    sessionIds.length && studentIds.length ? db.select().from(attendance).where(and(inArray(attendance.sessionId, sessionIds), inArray(attendance.studentId, studentIds))) : Promise.resolve([]),
    sessionIds.length && studentIds.length ? db.select().from(memorization).where(and(inArray(memorization.sessionId, sessionIds), inArray(memorization.studentId, studentIds))) : Promise.resolve([]),
    sessionIds.length && studentIds.length ? db.select().from(revision).where(and(inArray(revision.sessionId, sessionIds), inArray(revision.studentId, studentIds))) : Promise.resolve([]),
    sessionIds.length && studentIds.length ? db.select().from(evaluation).where(and(inArray(evaluation.sessionId, sessionIds), inArray(evaluation.studentId, studentIds))) : Promise.resolve([]),
  ]);
  const currentAttendanceRows = keepLatestAttendanceRows(attendanceRows);
  const reportBlocks = reportStudents.map((student) => {
    const studentAttendance = currentAttendanceRows.filter((row) => row.studentId === student.id);
    const mem = memorizationRows.filter((row) => row.studentId === student.id).map((row) => ({ id: row.id, kind: "memorization" as const, from: location(row.surahNumber, row.fromAyah), to: location(row.toSurahNumber ?? row.surahNumber, row.toAyah), pages: row.pages === null ? null : Number(row.pages), grade: row.grade ? GRADE_LABELS[row.grade] : null, date: row.createdAt, notes: row.notes }));
    const rev = revisionRows.filter((row) => row.studentId === student.id).map((row) => ({ id: row.id, kind: "revision" as const, from: location(row.surahNumber, row.fromAyah), to: location(row.toSurahNumber ?? row.surahNumber, row.toAyah), pages: row.pages === null ? null : Number(row.pages), grade: row.grade ? GRADE_LABELS[row.grade] : null, date: row.createdAt, notes: row.notes }));
    const studentEvaluations = evaluationRows.filter((row) => row.studentId === student.id).map((row) => ({ id: row.id, score: row.totalScore, rating: MIZAN_RATING_LABELS[scoreToStars(row.totalScore)], date: row.createdAt, notes: row.notes }));
    const scores = studentEvaluations.map((item) => item.score).filter((score): score is number => score !== null);
    return { student: { id: student.id, name: student.name, enrollmentDate: student.enrollmentDate }, attendance: { present: studentAttendance.filter((row) => row.status === "present").length, absent: studentAttendance.filter((row) => row.status === "absent").length, late: studentAttendance.filter((row) => row.status === "late").length, excused: studentAttendance.filter((row) => row.status === "excused").length, total: studentAttendance.length }, memorization: mem.sort((a, b) => b.date.getTime() - a.date.getTime()), revision: rev.sort((a, b) => b.date.getTime() - a.date.getTime()), averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null, evaluations: studentEvaluations.sort((a, b) => b.date.getTime() - a.date.getTime()) };
  });
  const attendanceTotals = currentAttendanceRows.reduce((totals, row) => ({ ...totals, [row.status]: totals[row.status] + 1 }), { present: 0, absent: 0, late: 0, excused: 0 });
  const allScores = reportBlocks.map((item) => item.averageScore).filter((score): score is number => score !== null);
  const sorted = [...reportBlocks].sort((left, right) => {
    if (input.sortBy === "enrollment") return (left.student.enrollmentDate?.getTime() ?? 0) - (right.student.enrollmentDate?.getTime() ?? 0);
    if (input.sortBy === "performance") return (right.averageScore ?? -1) - (left.averageScore ?? -1);
    if (input.sortBy === "attendance") return (right.attendance.total ? right.attendance.present / right.attendance.total : -1) - (left.attendance.total ? left.attendance.present / left.attendance.total : -1);
    return left.student.name.localeCompare(right.student.name, "ar");
  });
  const attendanceTotal = currentAttendanceRows.length;
  return { meta: { title: circle.name, typeLabel: typeLabel(input.reportType), circleName: circle.name, centerName: center?.name ?? "المركز", startDate: start ?? null, endDate: end ?? null, generatedAt: new Date() }, sections: input.sections, summary: { students: reportStudents.length, ...attendanceTotals, attendanceRate: attendanceTotal ? Math.round((attendanceTotals.present / attendanceTotal) * 100) : 0, memorizationCount: memorizationRows.length, revisionCount: revisionRows.length, averageScore: allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : null }, students: sorted };
}

function periodRange(period: "weekly" | "monthly", startDate?: Date, endDate?: Date) {
  const end = asDateBoundary(endDate ?? new Date(), true)!;
  if (startDate) return { start: asDateBoundary(startDate)!, end };
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period === "weekly" ? 6 : 29));
  return { start, end };
}

function bucketFor(date: Date, period: "weekly" | "monthly") {
  if (period === "monthly") {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: new Intl.DateTimeFormat("ar-SA", { month: "long", year: "numeric" }).format(date) };
  }
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const key = weekStart.toISOString().slice(0, 10);
  return { key, label: `${weekStart.toLocaleDateString("ar-SA", { month: "short", day: "numeric" })} — ${weekEnd.toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}` };
}

export async function buildExecutiveCircleReport(input: { circleId: number; period: "weekly" | "monthly"; startDate?: Date; endDate?: Date }): Promise<ExecutiveCircleReport> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [circle] = await db.select().from(circles).where(eq(circles.id, input.circleId)).limit(1);
  if (!circle) throw new Error("الحلقة غير موجودة");
  const { start, end } = periodRange(input.period, input.startDate, input.endDate);
  const periodSessions = await db.select().from(sessions).where(and(eq(sessions.circleId, input.circleId), isNull(sessions.deletedAt), ne(sessions.status, "draft"), gte(sessions.scheduledAt, start), lte(sessions.scheduledAt, end))).orderBy(sessions.scheduledAt);
  const sessionIds = periodSessions.map((session) => session.id);
  const [attendanceRows, memorizationRows, revisionRows] = await Promise.all([
    sessionIds.length ? db.select().from(attendance).where(inArray(attendance.sessionId, sessionIds)) : Promise.resolve([] as (typeof attendance.$inferSelect)[]),
    sessionIds.length ? db.select().from(memorization).where(inArray(memorization.sessionId, sessionIds)) : Promise.resolve([] as (typeof memorization.$inferSelect)[]),
    sessionIds.length ? db.select().from(revision).where(inArray(revision.sessionId, sessionIds)) : Promise.resolve([] as (typeof revision.$inferSelect)[]),
  ]);
  const currentAttendanceRows = keepLatestAttendanceRows(attendanceRows);
  const buckets = new Map<string, ExecutiveCircleReport["buckets"][number]>();
  for (const session of periodSessions) {
    const bucketInfo = bucketFor(session.scheduledAt, input.period);
    const bucket = buckets.get(bucketInfo.key) ?? { ...bucketInfo, sessions: 0, present: 0, absent: 0, late: 0, excused: 0, memorizationEntries: 0, revisionEntries: 0, memorizedPages: 0, reviewedPages: 0 };
    bucket.sessions += 1;
    const attendanceForSession = currentAttendanceRows.filter((row) => row.sessionId === session.id);
    bucket.present += attendanceForSession.filter((row) => row.status === "present").length;
    bucket.absent += attendanceForSession.filter((row) => row.status === "absent").length;
    bucket.late += attendanceForSession.filter((row) => row.status === "late").length;
    bucket.excused += attendanceForSession.filter((row) => row.status === "excused").length;
    const memorizationForSession = memorizationRows.filter((row) => row.sessionId === session.id);
    const revisionForSession = revisionRows.filter((row) => row.sessionId === session.id);
    bucket.memorizationEntries += memorizationForSession.length;
    bucket.revisionEntries += revisionForSession.length;
    bucket.memorizedPages += memorizationForSession.reduce((total, row) => total + Number(row.pages ?? 0), 0);
    bucket.reviewedPages += revisionForSession.reduce((total, row) => total + Number(row.pages ?? 0), 0);
    buckets.set(bucketInfo.key, bucket);
  }
  const summary = Array.from(buckets.values()).reduce((total, bucket) => ({ sessions: total.sessions + bucket.sessions, present: total.present + bucket.present, absent: total.absent + bucket.absent, late: total.late + bucket.late, excused: total.excused + bucket.excused, memorizationEntries: total.memorizationEntries + bucket.memorizationEntries, revisionEntries: total.revisionEntries + bucket.revisionEntries, memorizedPages: total.memorizedPages + bucket.memorizedPages, reviewedPages: total.reviewedPages + bucket.reviewedPages }), { sessions: 0, present: 0, absent: 0, late: 0, excused: 0, memorizationEntries: 0, revisionEntries: 0, memorizedPages: 0, reviewedPages: 0 });
  const attendanceTotal = summary.present + summary.absent + summary.late + summary.excused;
  return { meta: { circleId: circle.id, circleName: circle.name, startDate: start, endDate: end, period: input.period }, summary: { ...summary, attendanceRate: attendanceTotal ? Math.round((summary.present / attendanceTotal) * 100) : 0 }, buckets: Array.from(buckets.values()) };
}

function studentAgeGroup(birthDate: Date | null, referenceDate: Date): StudentAgeGroup | null {
  if (!birthDate) return null;
  let years = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = referenceDate.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && referenceDate.getDate() < birthDate.getDate())) years -= 1;
  if (years < 10) return "under_10";
  if (years < 14) return "10_13";
  if (years < 18) return "14_17";
  return "18_plus";
}

export async function buildCenterManagementReport(input: { centerId: number; period: "weekly" | "monthly"; startDate?: Date; endDate?: Date; teacherId?: number; ageGroup?: StudentAgeGroup }): Promise<CenterManagementReport> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [center] = await db.select().from(centers).where(and(eq(centers.id, input.centerId), isNull(centers.deletedAt))).limit(1);
  if (!center) throw new Error("المركز غير موجود");
  const { start, end } = periodRange(input.period, input.startDate, input.endDate);
  const allCenterCircles = await db.select({ id: circles.id, name: circles.name, teacherId: circles.teacherId, assistantTeacherId: circles.assistantTeacherId, teacherName: teachers.name, teacherPhone: teachers.phone, teacherEmail: teachers.email }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).leftJoin(teachers, eq(circles.teacherId, teachers.id)).where(and(eq(branches.centerId, input.centerId), isNull(branches.deletedAt), isNull(circles.deletedAt), eq(circles.isActive, true)));
  const centerCircles = input.teacherId ? allCenterCircles.filter((circle) => circle.teacherId === input.teacherId || circle.assistantTeacherId === input.teacherId) : allCenterCircles;
  const circleIds = centerCircles.map((circle) => circle.id);
  const allStudents = circleIds.length ? await db.select({ id: students.id, circleId: students.circleId, birthDate: students.birthDate }).from(students).where(and(eq(students.centerId, input.centerId), eq(students.isActive, true), isNull(students.deletedAt), inArray(students.circleId, circleIds))) : [];
  const reportStudents = input.ageGroup ? allStudents.filter((student) => studentAgeGroup(student.birthDate, end) === input.ageGroup) : allStudents;
  const studentIds = reportStudents.map((student) => student.id);
  const baseSessionConditions = [isNull(sessions.deletedAt), ne(sessions.status, "draft"), gte(sessions.scheduledAt, start), lte(sessions.scheduledAt, end)];
  const periodSessions = circleIds.length ? await db.select().from(sessions).where(and(inArray(sessions.circleId, circleIds), ...baseSessionConditions)).orderBy(sessions.scheduledAt) : [];
  const sessionIds = periodSessions.map((session) => session.id);
  const [attendanceRows, memorizationRows, revisionRows, drafts, goals, preferences] = await Promise.all([
    sessionIds.length && studentIds.length ? db.select().from(attendance).where(and(inArray(attendance.sessionId, sessionIds), inArray(attendance.studentId, studentIds))) : Promise.resolve([] as (typeof attendance.$inferSelect)[]),
    sessionIds.length && studentIds.length ? db.select().from(memorization).where(and(inArray(memorization.sessionId, sessionIds), inArray(memorization.studentId, studentIds))) : Promise.resolve([] as (typeof memorization.$inferSelect)[]),
    sessionIds.length && studentIds.length ? db.select().from(revision).where(and(inArray(revision.sessionId, sessionIds), inArray(revision.studentId, studentIds))) : Promise.resolve([] as (typeof revision.$inferSelect)[]),
    circleIds.length ? db.select({ id: sessions.id, circleId: sessions.circleId }).from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt), eq(sessions.status, "draft"))) : Promise.resolve([] as { id: number; circleId: number }[]),
    getReportingGoals(input.centerId),
    getReportingPreferences(input.centerId),
  ]);
  const currentAttendanceRows = keepLatestAttendanceRows(attendanceRows);
  const byCircle = new Map<number, CenterManagementReport["comparisons"][number]>();
  const memorizationStudentIds = new Set(memorizationRows.map((row) => row.studentId));
  const revisionStudentIds = new Set(revisionRows.map((row) => row.studentId));
  const progressStudentIds = new Set(Array.from(memorizationStudentIds).concat(Array.from(revisionStudentIds)));
  for (const circle of centerCircles) {
    const circleStudents = reportStudents.filter((student) => student.circleId === circle.id);
    const studentsWithRecordedProgress = circleStudents.filter((student) => progressStudentIds.has(student.id)).length;
    byCircle.set(circle.id, { circleId: circle.id, circleName: circle.name, teacherName: circle.teacherName, teacherPhone: circle.teacherPhone, teacherEmail: circle.teacherEmail, sessions: 0, attendanceRate: 0, memorizedPages: 0, reviewedPages: 0, activityEntries: 0, activeStudents: circleStudents.length, studentsWithRecordedProgress, progressCoverageRate: circleStudents.length ? Math.round((studentsWithRecordedProgress / circleStudents.length) * 100) : 0 });
  }
  const trendMap = new Map<string, { key: string; label: string; sessions: number; present: number; absent: number; late: number; excused: number; memorizedPages: number; reviewedPages: number }>();
  for (const session of periodSessions) {
    const circle = byCircle.get(session.circleId);
    if (!circle) continue;
    const attendanceForSession = currentAttendanceRows.filter((row) => row.sessionId === session.id);
    const mem = memorizationRows.filter((row) => row.sessionId === session.id);
    const rev = revisionRows.filter((row) => row.sessionId === session.id);
    circle.sessions += 1;
    circle.memorizedPages += mem.reduce((total, row) => total + Number(row.pages ?? 0), 0);
    circle.reviewedPages += rev.reduce((total, row) => total + Number(row.pages ?? 0), 0);
    circle.activityEntries += mem.length + rev.length;
    const bucketInfo = bucketFor(session.scheduledAt, input.period);
    const bucket = trendMap.get(bucketInfo.key) ?? { ...bucketInfo, sessions: 0, present: 0, absent: 0, late: 0, excused: 0, memorizedPages: 0, reviewedPages: 0 };
    bucket.sessions += 1;
    bucket.present += attendanceForSession.filter((row) => row.status === "present").length;
    bucket.absent += attendanceForSession.filter((row) => row.status === "absent").length;
    bucket.late += attendanceForSession.filter((row) => row.status === "late").length;
    bucket.excused += attendanceForSession.filter((row) => row.status === "excused").length;
    bucket.memorizedPages += mem.reduce((total, row) => total + Number(row.pages ?? 0), 0);
    bucket.reviewedPages += rev.reduce((total, row) => total + Number(row.pages ?? 0), 0);
    trendMap.set(bucketInfo.key, bucket);
  }
  for (const circle of Array.from(byCircle.values())) {
    const relevantSessionIds = periodSessions.filter((session) => session.circleId === circle.circleId).map((session) => session.id);
    const circleAttendance = currentAttendanceRows.filter((row) => relevantSessionIds.includes(row.sessionId));
    circle.attendanceRate = circleAttendance.length ? Math.round((circleAttendance.filter((row) => row.status === "present").length / circleAttendance.length) * 100) : 0;
  }
  const summaryBase = Array.from(trendMap.values()).reduce((total, bucket) => ({ sessions: total.sessions + bucket.sessions, present: total.present + bucket.present, absent: total.absent + bucket.absent, late: total.late + bucket.late, excused: total.excused + bucket.excused, memorizedPages: total.memorizedPages + bucket.memorizedPages, reviewedPages: total.reviewedPages + bucket.reviewedPages }), { sessions: 0, present: 0, absent: 0, late: 0, excused: 0, memorizedPages: 0, reviewedPages: 0 });
  const attendanceTotal = summaryBase.present + summaryBase.absent + summaryBase.late + summaryBase.excused;
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const scaleTarget = (target: number | null | undefined) => target == null ? null : Math.round((target * Math.min(days, 30)) / 30);
  const comparisons = Array.from(byCircle.values()).sort((left, right) => right.attendanceRate - left.attendanceRate || right.memorizedPages - left.memorizedPages);
  const trend = Array.from(trendMap.values()).map((bucket) => { const total = bucket.present + bucket.absent + bucket.late + bucket.excused; return { key: bucket.key, label: bucket.label, sessions: bucket.sessions, attendanceRate: total ? Math.round((bucket.present / total) * 100) : 0, memorizedPages: bucket.memorizedPages, reviewedPages: bucket.reviewedPages }; });
  const alerts: CenterManagementReport["alerts"] = [];
  for (const circle of comparisons) {
    const action = { teacherName: circle.teacherName, teacherPhone: circle.teacherPhone, teacherEmail: circle.teacherEmail };
    if (circle.sessions === 0) alerts.push({ id: `no-activity-${circle.circleId}`, severity: "attention", circleId: circle.circleId, title: `لا توجد فترات معتمدة في ${circle.circleName}`, description: "لم تسجل الحلقة فترة معتمدة ضمن النطاق المحدد.", ...action });
    else if (circle.attendanceRate < 75) alerts.push({ id: `attendance-${circle.circleId}`, severity: "warning", circleId: circle.circleId, title: `نسبة حضور منخفضة في ${circle.circleName}`, description: `بلغت نسبة الحضور ${circle.attendanceRate}%، وهي أقل من حد المتابعة 75%.`, ...action });
    if (circle.sessions > 0 && circle.activityEntries === 0) alerts.push({ id: `progress-${circle.circleId}`, severity: "attention", circleId: circle.circleId, title: `لا توجد سجلات حفظ أو مراجعة في ${circle.circleName}`, description: "توجد فترات معتمدة، لكن لم تسجل لها بيانات حفظ أو مراجعة في هذا النطاق.", ...action });
    else if (circle.sessions > 0 && circle.studentsWithRecordedProgress < circle.activeStudents) alerts.push({ id: `progress-coverage-${circle.circleId}`, severity: "attention", circleId: circle.circleId, title: `استكمل توثيق تقدم الطلاب في ${circle.circleName}`, description: `يوجد سجل حفظ أو مراجعة موثق لـ ${circle.studentsWithRecordedProgress} من ${circle.activeStudents} طلاب ضمن النطاق المحدد.`, ...action });
  }
  if (drafts.length) alerts.push({ id: "drafts", severity: "attention", title: `توجد ${drafts.length} مسودات غير معتمدة`, description: "لن تدخل المسودات في تقارير الإدارة إلى أن يعتمدها المعلم من داخل الفترة." });
  const selectedTeacher = input.teacherId ? allCenterCircles.find((circle) => circle.teacherId === input.teacherId || circle.assistantTeacherId === input.teacherId) : undefined;
  return { meta: { centerId: center.id, centerName: center.name, startDate: start, endDate: end, period: input.period, days, filters: { teacherId: input.teacherId ?? null, teacherName: selectedTeacher?.teacherName ?? null, ageGroup: input.ageGroup ?? null }, branding: { headerTitle: preferences?.headerTitle ?? center.name, footerText: preferences?.footerText ?? null, logoUrl: preferences?.logoUrl ?? center.logoUrl ?? null, logoKey: preferences?.logoKey ?? center.logoKey ?? null, teacherMessageTemplate: preferences?.teacherMessageTemplate ?? null } }, summary: { ...summaryBase, attendanceRate: attendanceTotal ? Math.round((summaryBase.present / attendanceTotal) * 100) : 0, memorizationEntries: memorizationRows.length, revisionEntries: revisionRows.length, activeCircles: circleIds.length, activeStudents: studentIds.length, studentsWithMemorization: memorizationStudentIds.size, studentsWithRevision: revisionStudentIds.size, studentsWithRecordedProgress: progressStudentIds.size, studentsWithoutRecordedProgress: Math.max(0, studentIds.length - progressStudentIds.size) }, goals: { attendanceTarget: goals?.attendanceTarget ?? null, memorizedPagesTarget: goals?.memorizedPagesTarget ?? null, reviewedPagesTarget: goals?.reviewedPagesTarget ?? null, projectedMemorizedPagesTarget: scaleTarget(goals?.memorizedPagesTarget), projectedReviewedPagesTarget: scaleTarget(goals?.reviewedPagesTarget) }, comparisons, trend, alerts };
}
