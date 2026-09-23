import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import {
  attendance,
  branches,
  centers,
  circles,
  memorization,
  sessions,
  students,
  teachers,
} from "../../drizzle/schema";
import { keepLatestAttendanceRows } from "./attendance";
import { getCenterById } from "./centers";
import { getDb } from "./connection";

// ===================== DASHBOARD STATS =====================
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalStudents: 0, totalTeachers: 0, totalCenters: 0, totalCircles: 0, totalSessions: 0 };

  const [studentsCount, teachersCount, centersCount, circlesCount, sessionsCount, openSessionsCount, todayPresent, todayAbsent] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(isNull(students.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(teachers).where(isNull(teachers.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(centers).where(isNull(centers.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(circles).where(isNull(circles.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(isNull(sessions.deletedAt), ne(sessions.status, "draft"))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(isNull(sessions.deletedAt), eq(sessions.status, 'open'))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).where(and(eq(attendance.status, 'present'), ne(sessions.status, "draft"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).where(and(eq(attendance.status, 'absent'), ne(sessions.status, "draft"))),
  ]);

  return {
    totalStudents: studentsCount[0]?.count ?? 0,
    totalTeachers: teachersCount[0]?.count ?? 0,
    totalCenters: centersCount[0]?.count ?? 0,
    totalCircles: circlesCount[0]?.count ?? 0,
    totalSessions: sessionsCount[0]?.count ?? 0,
    openSessions: openSessionsCount[0]?.count ?? 0,
    todayAttendance: todayPresent[0]?.count ?? 0,
    todayAbsence: todayAbsent[0]?.count ?? 0,
  };
}

export async function getDashboardStatsForCenters(centerIds: number[]) {
  const empty = { totalStudents: 0, totalTeachers: 0, totalCenters: 0, totalCircles: 0, totalSessions: 0, openSessions: 0, todayAttendance: 0, todayAbsence: 0 };
  if (!centerIds.length) return empty;
  const db = await getDb();
  if (!db) return empty;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const [studentsCount, teachersCount, circlesCount, sessionsCount, openSessionsCount, presentCount, absentCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(and(inArray(students.centerId, centerIds), isNull(students.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(teachers).where(and(inArray(teachers.centerId, centerIds), isNull(teachers.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(circles.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(sessions.deletedAt), ne(sessions.status, "draft"))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(sessions.deletedAt), eq(sessions.status, "open"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "present"), ne(sessions.status, "draft"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "absent"), ne(sessions.status, "draft"))),
  ]);
  return { totalStudents: studentsCount[0]?.count ?? 0, totalTeachers: teachersCount[0]?.count ?? 0, totalCenters: centerIds.length, totalCircles: circlesCount[0]?.count ?? 0, totalSessions: sessionsCount[0]?.count ?? 0, openSessions: openSessionsCount[0]?.count ?? 0, todayAttendance: presentCount[0]?.count ?? 0, todayAbsence: absentCount[0]?.count ?? 0 };
}

export async function getCenterManagerOverview(centerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const center = await getCenterById(centerId);
  if (!center) throw new Error("المركز غير موجود");
  const since = new Date(); since.setDate(since.getDate() - 29); since.setHours(0, 0, 0, 0);
  const [teacherRows, studentRows, circleRows] = await Promise.all([
    db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.centerId, centerId), eq(teachers.isActive, true), isNull(teachers.deletedAt))),
    db.select({ id: students.id }).from(students).where(and(eq(students.centerId, centerId), eq(students.isActive, true), isNull(students.deletedAt))),
    db.select({ id: circles.id, name: circles.name, teacherName: teachers.name }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).leftJoin(teachers, eq(circles.teacherId, teachers.id)).where(and(eq(branches.centerId, centerId), eq(circles.isActive, true), isNull(circles.deletedAt), isNull(branches.deletedAt))),
  ]);
  const circleIds = circleRows.map((circle) => circle.id);
  const sessionRows = circleIds.length ? await db.select({ id: sessions.id, circleId: sessions.circleId, scheduledAt: sessions.scheduledAt }).from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt), ne(sessions.status, "draft"), gte(sessions.scheduledAt, since))).orderBy(sessions.scheduledAt) : [];
  const sessionIds = sessionRows.map((session) => session.id);
  const [attendanceRows, memorizationRows] = await Promise.all([
    sessionIds.length ? db.select().from(attendance).where(inArray(attendance.sessionId, sessionIds)) : Promise.resolve([] as (typeof attendance.$inferSelect)[]),
    sessionIds.length ? db.select().from(memorization).where(inArray(memorization.sessionId, sessionIds)) : Promise.resolve([] as (typeof memorization.$inferSelect)[]),
  ]);
  const latestAttendance = keepLatestAttendanceRows(attendanceRows);
  const circleMetrics = circleRows.map((circle) => { const ids = sessionRows.filter((session) => session.circleId === circle.id).map((session) => session.id); const rows = latestAttendance.filter((item) => ids.includes(item.sessionId)); const mem = memorizationRows.filter((item) => ids.includes(item.sessionId)); return { circleId: circle.id, circleName: circle.name, teacherName: circle.teacherName, sessions: ids.length, attendanceRate: rows.length ? Math.round((rows.filter((item) => item.status === "present").length / rows.length) * 100) : 0, memorizedPages: mem.reduce((total, item) => total + Number(item.pages ?? 0), 0) }; }).sort((left, right) => right.attendanceRate - left.attendanceRate || right.memorizedPages - left.memorizedPages);
  const trendMap = new Map<string, { label: string; sessions: number; present: number; total: number; memorizedPages: number }>();
  for (const session of sessionRows) { const key = session.scheduledAt.toISOString().slice(0, 10); const bucket = trendMap.get(key) ?? { label: new Date(session.scheduledAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }), sessions: 0, present: 0, total: 0, memorizedPages: 0 }; const rows = latestAttendance.filter((item) => item.sessionId === session.id); const mem = memorizationRows.filter((item) => item.sessionId === session.id); bucket.sessions += 1; bucket.present += rows.filter((item) => item.status === "present").length; bucket.total += rows.length; bucket.memorizedPages += mem.reduce((total, item) => total + Number(item.pages ?? 0), 0); trendMap.set(key, bucket); }
  const attendanceTotal = latestAttendance.length;
  return { profile: { id: center.id, name: center.name, logoUrl: center.logoUrl, phone: center.phone, email: center.email, city: center.city }, summary: { teachers: teacherRows.length, students: studentRows.length, circles: circleRows.length, approvedSessions: sessionRows.length, attendanceRate: attendanceTotal ? Math.round((latestAttendance.filter((item) => item.status === "present").length / attendanceTotal) * 100) : 0, memorizedPages: memorizationRows.reduce((total, item) => total + Number(item.pages ?? 0), 0) }, trend: Array.from(trendMap.values()).map((item) => ({ ...item, attendanceRate: item.total ? Math.round((item.present / item.total) * 100) : 0 })), circles: circleMetrics };
}

/** إحصاءات لوحة المعلم/الموجه داخل الحلقات التي يملك صلاحية قراءتها فقط. */
export async function getDashboardStatsForCircles(circleIds: number[]) {
  const empty = { totalStudents: 0, totalTeachers: 0, totalCenters: 0, totalCircles: 0, totalSessions: 0, openSessions: 0, todayAttendance: 0, todayAbsence: 0 };
  if (!circleIds.length) return empty;
  const db = await getDb();
  if (!db) return empty;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const [studentsCount, teachersCount, centersCount, sessionsCount, openSessionsCount, presentCount, absentCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(and(inArray(students.circleId, circleIds), isNull(students.deletedAt))),
    db.select({ count: sql<number>`count(distinct ${circles.teacherId})` }).from(circles).where(and(inArray(circles.id, circleIds), isNull(circles.deletedAt))),
    db.select({ count: sql<number>`count(distinct ${branches.centerId})` }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(circles.id, circleIds), isNull(circles.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt), ne(sessions.status, "draft"))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt), eq(sessions.status, "open"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).where(and(inArray(sessions.circleId, circleIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "present"), ne(sessions.status, "draft"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).where(and(inArray(sessions.circleId, circleIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "absent"), ne(sessions.status, "draft"))),
  ]);
  return {
    totalStudents: studentsCount[0]?.count ?? 0,
    totalTeachers: teachersCount[0]?.count ?? 0,
    totalCenters: centersCount[0]?.count ?? 0,
    totalCircles: circleIds.length,
    totalSessions: sessionsCount[0]?.count ?? 0,
    openSessions: openSessionsCount[0]?.count ?? 0,
    todayAttendance: presentCount[0]?.count ?? 0,
    todayAbsence: absentCount[0]?.count ?? 0,
  };
}

export async function getRecentSessions(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(and(isNull(sessions.deletedAt), ne(sessions.status, "draft"))).orderBy(desc(sessions.createdAt)).limit(limit);
}

export async function getRecentSessionsForCenters(centerIds: number[], limit = 5) {
  if (!centerIds.length) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ session: sessions }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(sessions.deletedAt), ne(sessions.status, "draft"))).orderBy(desc(sessions.createdAt)).limit(limit);
  return rows.map((row) => row.session);
}

export async function getRecentSessionsForCircles(circleIds: number[], limit = 5) {
  if (!circleIds.length) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt), ne(sessions.status, "draft"))).orderBy(desc(sessions.createdAt)).limit(limit);
}
