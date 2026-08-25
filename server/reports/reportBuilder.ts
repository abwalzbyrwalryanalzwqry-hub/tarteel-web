import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { getDb, keepLatestAttendanceRows } from "../db";
import { attendance, branches, centers, circles, evaluation, memorization, revision, sessions, students } from "../../drizzle/schema";
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
