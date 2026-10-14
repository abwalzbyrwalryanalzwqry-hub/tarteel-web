import { and, desc, inArray, isNotNull, sql } from "drizzle-orm";
import { dailyEntries, students } from "../../drizzle/schema";
import { getDb } from "./connection";
import { isSqliteDialect } from "./dialect";

/**
 * سجل الصفحة في قسم المصحف: الحفظ والمراجعة في السجل اليومي التي يقع مداها (ولو جزئياً) في صفحة
 * المصحف. المدى والصفحة يُقارنان بمفتاح السورة×1000+الآية، فيعمل في MySQL وSQLite معاً. المدى التنازلي
 * (من الناس صعوداً) يُقارن بطرفيه بعد ترتيبهما.
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
    const c =
      kind === "memorize"
        ? { fs: dailyEntries.memFromSurah, fa: dailyEntries.memFromAyah, ts: dailyEntries.memToSurah, ta: dailyEntries.memToAyah, g: dailyEntries.memGrade, n: dailyEntries.memNotes }
        : { fs: dailyEntries.revFromSurah, fa: dailyEntries.revFromAyah, ts: dailyEntries.revToSurah, ta: dailyEntries.revToAyah, g: dailyEntries.revGrade, n: dailyEntries.revNotes };
    // أصغر الطرفين وأكبرهما: least/greatest في MySQL، وmin/max بقيمتين في SQLite.
    const [mn, mx] = isSqliteDialect() ? [sql.raw("min"), sql.raw("max")] : [sql.raw("least"), sql.raw("greatest")];
    const lo = sql`${mn}(${c.fs} * 1000 + ${c.fa}, ${c.ts} * 1000 + ${c.ta})`;
    const hi = sql`${mx}(${c.fs} * 1000 + ${c.fa}, ${c.ts} * 1000 + ${c.ta})`;
    const rows = await db
      .select({
        id: dailyEntries.id,
        recordId: dailyEntries.recordId,
        circleId: dailyEntries.circleId,
        recordDate: dailyEntries.recordDate,
        studentId: dailyEntries.studentId,
        studentName: students.name,
        surahNumber: c.fs,
        toSurahNumber: c.ts,
        fromAyah: c.fa,
        toAyah: c.ta,
        grade: c.g,
        notes: c.n,
        updatedAt: dailyEntries.updatedAt,
      })
      .from(dailyEntries)
      .innerJoin(students, sql`${students.id} = ${dailyEntries.studentId}`)
      .where(
        and(
          inArray(dailyEntries.studentId, studentIds),
          isNotNull(c.fs),
          sql`${lo} <= ${end}`,
          sql`${hi} >= ${start}`
        )
      )
      .orderBy(desc(dailyEntries.recordDate), desc(dailyEntries.updatedAt))
      .limit(limit);
    return rows.map(row => ({
      ...row,
      surahNumber: row.surahNumber!,
      toSurahNumber: row.toSurahNumber!,
      fromAyah: row.fromAyah!,
      toAyah: row.toAyah!,
      kind,
    }));
  };
  const [memorized, revised] = [await load("memorize"), await load("review")];
  return [...memorized, ...revised]
    .sort(
      (a, b) =>
        b.recordDate.localeCompare(a.recordDate) ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
}
