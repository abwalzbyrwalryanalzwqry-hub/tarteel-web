import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  circles,
  dailyEntries,
  dailyRecords,
  students,
  teachers,
} from "../../drizzle/schema";
import { addDays } from "../../shared/dailyRecord";
import { getRiyadhDayKey } from "../../shared/dates";
import { getCenterById } from "./centers";
import { getDb } from "./connection";

/**
 * إحصاءات اللوحات من السجل اليومي: عدد الأيام المسجّلة، والمفتوحة اليوم، وحضور اليوم وغيابه. اليوم هو
 * اليوم التشغيلي نفسه الذي يفتح به المعلم سجل حلقته.
 */
const EMPTY = {
  totalStudents: 0,
  totalTeachers: 0,
  totalCenters: 0,
  totalCircles: 0,
  totalDays: 0,
  openToday: 0,
  todayAttendance: 0,
  todayAbsence: 0,
};
export type DashboardStats = typeof EMPTY;

const count = sql<number>`count(*)`;

async function dayStats(circleIds: number[]) {
  const db = await getDb();
  if (!db || !circleIds.length) return { totalDays: 0, openToday: 0, todayAttendance: 0, todayAbsence: 0 };
  const today = getRiyadhDayKey(new Date());
  const [days, open, today_] = await Promise.all([
    db.select({ n: count }).from(dailyRecords).where(inArray(dailyRecords.circleId, circleIds)),
    db
      .select({ n: count })
      .from(dailyRecords)
      .where(and(inArray(dailyRecords.circleId, circleIds), eq(dailyRecords.recordDate, today), eq(dailyRecords.status, "open"))),
    db
      .select({ status: dailyEntries.status, n: count })
      .from(dailyEntries)
      .where(and(inArray(dailyEntries.circleId, circleIds), eq(dailyEntries.recordDate, today)))
      .groupBy(dailyEntries.status),
  ]);
  const by = (s: string) => Number(today_.find(r => r.status === s)?.n ?? 0);
  return {
    totalDays: Number(days[0]?.n ?? 0),
    openToday: Number(open[0]?.n ?? 0),
    todayAttendance: by("present") + by("late"),
    todayAbsence: by("absent"),
  };
}

export async function getDashboardStatsForCenters(centerIds: number[]): Promise<DashboardStats> {
  if (!centerIds.length) return EMPTY;
  const db = await getDb();
  if (!db) return EMPTY;
  const [studentsCount, teachersCount, circleRows] = await Promise.all([
    db.select({ n: count }).from(students).where(and(inArray(students.centerId, centerIds), isNull(students.deletedAt))),
    db.select({ n: count }).from(teachers).where(and(inArray(teachers.centerId, centerIds), isNull(teachers.deletedAt))),
    db.select({ id: circles.id }).from(circles).where(and(inArray(circles.centerId, centerIds), isNull(circles.deletedAt))),
  ]);
  const ids = circleRows.map(c => c.id);
  return {
    totalStudents: Number(studentsCount[0]?.n ?? 0),
    totalTeachers: Number(teachersCount[0]?.n ?? 0),
    totalCenters: centerIds.length,
    totalCircles: ids.length,
    ...(await dayStats(ids)),
  };
}

/** إحصاءات لوحة المعلم/الموجه داخل الحلقات التي يملك صلاحية قراءتها فقط. */
export async function getDashboardStatsForCircles(circleIds: number[]): Promise<DashboardStats> {
  if (!circleIds.length) return EMPTY;
  const db = await getDb();
  if (!db) return EMPTY;
  const [studentsCount, teachersCount, centersCount] = await Promise.all([
    db.select({ n: count }).from(students).where(and(inArray(students.circleId, circleIds), isNull(students.deletedAt))),
    db
      .select({ n: sql<number>`count(distinct ${circles.teacherId})` })
      .from(circles)
      .where(and(inArray(circles.id, circleIds), isNull(circles.deletedAt))),
    db
      .select({ n: sql<number>`count(distinct ${circles.centerId})` })
      .from(circles)
      .where(and(inArray(circles.id, circleIds), isNull(circles.deletedAt))),
  ]);
  return {
    totalStudents: Number(studentsCount[0]?.n ?? 0),
    totalTeachers: Number(teachersCount[0]?.n ?? 0),
    totalCenters: Number(centersCount[0]?.n ?? 0),
    totalCircles: circleIds.length,
    ...(await dayStats(circleIds)),
  };
}

export async function getCircleIdsForCenters(centerIds: number[]) {
  const db = await getDb();
  if (!db || !centerIds.length) return [];
  const rows = await db
    .select({ id: circles.id })
    .from(circles)
    .where(and(inArray(circles.centerId, centerIds), isNull(circles.deletedAt)));
  return rows.map(r => r.id);
}

/** آخر أيام السجل في الحلقات: الحلقة والتاريخ والحالة وأعداد الحضور والإنجاز. */
export async function getRecentDailyRecords(circleIds: number[], limit = 5) {
  const db = await getDb();
  if (!db || !circleIds.length) return [];
  const recs = await db
    .select({
      id: dailyRecords.id,
      circleId: dailyRecords.circleId,
      circleName: circles.name,
      date: dailyRecords.recordDate,
      status: dailyRecords.status,
      updatedAt: dailyRecords.updatedAt,
    })
    .from(dailyRecords)
    .innerJoin(circles, eq(circles.id, dailyRecords.circleId))
    .where(inArray(dailyRecords.circleId, circleIds))
    .orderBy(desc(dailyRecords.recordDate), desc(dailyRecords.updatedAt))
    .limit(limit);
  if (!recs.length) return [];
  const rows = await db
    .select({ recordId: dailyEntries.recordId, status: dailyEntries.status, mem: dailyEntries.memFromSurah, rev: dailyEntries.revFromSurah })
    .from(dailyEntries)
    .where(inArray(dailyEntries.recordId, recs.map(r => r.id)));
  return recs.map(r => {
    const mine = rows.filter(x => x.recordId === r.id);
    return {
      ...r,
      present: mine.filter(x => x.status === "present" || x.status === "late").length,
      absent: mine.filter(x => x.status === "absent").length,
      memorized: mine.filter(x => x.mem != null).length,
      reviewed: mine.filter(x => x.rev != null).length,
    };
  });
}

/** نظرة مدير المركز لآخر 30 يوماً: الحضور والإنجاز لكل حلقة، واتجاه يومي. */
export async function getCenterManagerOverview(centerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const center = await getCenterById(centerId);
  if (!center) throw new Error("المركز غير موجود");
  const today = getRiyadhDayKey(new Date());
  const since = addDays(today, -29);
  const [teacherRows, studentRows, circleRows] = await Promise.all([
    db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.centerId, centerId), eq(teachers.isActive, true), isNull(teachers.deletedAt))),
    db.select({ id: students.id }).from(students).where(and(eq(students.centerId, centerId), eq(students.isActive, true), isNull(students.deletedAt))),
    db
      .select({ id: circles.id, name: circles.name, teacherName: teachers.name })
      .from(circles)
      .leftJoin(teachers, eq(circles.teacherId, teachers.id))
      .where(and(eq(circles.centerId, centerId), eq(circles.isActive, true), isNull(circles.deletedAt))),
  ]);
  const circleIds = circleRows.map(c => c.id);
  const [recs, entries] = circleIds.length
    ? await Promise.all([
        db
          .select()
          .from(dailyRecords)
          .where(and(inArray(dailyRecords.circleId, circleIds), gte(dailyRecords.recordDate, since)))
          .orderBy(dailyRecords.recordDate),
        db
          .select()
          .from(dailyEntries)
          .where(and(inArray(dailyEntries.circleId, circleIds), gte(dailyEntries.recordDate, since))),
      ])
    : [[], []];
  const marked = (rows: typeof entries) => rows.filter(e => e.status != null);
  const present = (rows: typeof entries) => rows.filter(e => e.status === "present" || e.status === "late").length;
  const rate = (rows: typeof entries) => {
    const m = marked(rows).length;
    return m ? Math.round((present(rows) / m) * 100) : 0;
  };
  const circleMetrics = circleRows
    .map(c => {
      const rows = entries.filter(e => e.circleId === c.id);
      return {
        circleId: c.id,
        circleName: c.name,
        teacherName: c.teacherName,
        days: recs.filter(r => r.circleId === c.id).length,
        completedDays: recs.filter(r => r.circleId === c.id && r.status !== "open").length,
        attendanceRate: rate(rows),
        memorized: rows.filter(e => e.memFromSurah != null).length,
        reviewed: rows.filter(e => e.revFromSurah != null).length,
        recordedToday: recs.some(r => r.circleId === c.id && r.recordDate === today),
      };
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate || b.memorized - a.memorized);
  const trendMap = new Map<string, { date: string; label: string; days: number; present: number; total: number; memorized: number }>();
  for (const r of recs) {
    const bucket = trendMap.get(r.recordDate) ?? {
      date: r.recordDate,
      label: new Date(`${r.recordDate}T12:00:00Z`).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }),
      days: 0,
      present: 0,
      total: 0,
      memorized: 0,
    };
    const rows = entries.filter(e => e.recordId === r.id);
    bucket.days += 1;
    bucket.present += present(rows);
    bucket.total += marked(rows).length;
    bucket.memorized += rows.filter(e => e.memFromSurah != null).length;
    trendMap.set(r.recordDate, bucket);
  }
  return {
    profile: { id: center.id, name: center.name, logoUrl: center.logoUrl, phone: center.phone, email: center.email, city: center.city },
    summary: {
      teachers: teacherRows.length,
      students: studentRows.length,
      circles: circleRows.length,
      days: recs.length,
      recordedToday: circleMetrics.filter(c => c.recordedToday).length,
      attendanceRate: rate(entries),
      memorized: entries.filter(e => e.memFromSurah != null).length,
      reviewed: entries.filter(e => e.revFromSurah != null).length,
    },
    trend: Array.from(trendMap.values()).map(t => ({ ...t, attendanceRate: t.total ? Math.round((t.present / t.total) * 100) : 0 })),
    circles: circleMetrics,
  };
}

