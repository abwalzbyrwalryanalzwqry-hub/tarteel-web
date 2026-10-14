import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  memorization,
  revision,
  sessions,
  students,
} from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * سجل الصفحة في قسم المصحف: تسجيلات الحفظ والمراجعة في الفترات التي يقع مقطعها (ولو جزئياً) في
 * صفحة المصحف. المقطع والصفحة يُقارنان بمفتاح السورة×1000+الآية، فيعمل في MySQL وSQLite معاً.
 */
export type QuranRange = {
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number;
};

export function rangeKey(surah: number, ayah: number): number {
  return surah * 1000 + ayah;
}

export async function getQuranRecordsInRange(
  studentIds: number[],
  range: QuranRange,
  limit = 100
) {
  if (studentIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const start = rangeKey(range.fromSurah, range.fromAyah);
  const end = rangeKey(range.toSurah, range.toAyah);
  const load = async (kind: "memorize" | "review") => {
    const table = kind === "memorize" ? memorization : revision;
    const rows = await db
      .select({
        id: table.id,
        sessionId: table.sessionId,
        studentId: table.studentId,
        studentName: students.name,
        surahNumber: table.surahNumber,
        toSurahNumber: table.toSurahNumber,
        fromAyah: table.fromAyah,
        toAyah: table.toAyah,
        grade: table.grade,
        notes: table.notes,
        scheduledAt: sessions.scheduledAt,
        createdAt: table.createdAt,
      })
      .from(table)
      .innerJoin(sessions, eq(table.sessionId, sessions.id))
      .innerJoin(students, eq(table.studentId, students.id))
      .where(
        and(
          inArray(table.studentId, studentIds),
          isNull(sessions.deletedAt),
          ne(sessions.status, "cancelled"),
          sql`(${table.surahNumber} * 1000 + ${table.fromAyah}) <= ${end}`,
          sql`(coalesce(${table.toSurahNumber}, ${table.surahNumber}) * 1000 + ${table.toAyah}) >= ${start}`
        )
      )
      .orderBy(desc(sessions.scheduledAt), desc(table.createdAt))
      .limit(limit);
    return rows.map(row => ({ ...row, kind }));
  };
  const [memorized, revised] = await Promise.all([
    load("memorize"),
    load("review"),
  ]);
  return [...memorized, ...revised]
    .sort(
      (a, b) =>
        b.scheduledAt.getTime() - a.scheduledAt.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime()
    )
    .slice(0, limit);
}
