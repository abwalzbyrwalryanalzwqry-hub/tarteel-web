/**
 * السجل اليومي للحلقة على خادم ترتيل: نظير دوال قاعدة بيانات زِن (supabase/migrations/2026111710…
 * إلى 20261203…) بالشكل نفسه الذي تقرؤه شاشات السجل والتقارير المنقولة (DaySheet وHistoryDay وReportData).
 *
 * - السجل: مفتوح ← مكتمل ← معتمد. المكتمل يُعاد فتحه، والمعتمد لا يُعدَّل. رقم النسخة في السجل وفي سطر كل
 *   طالب يمنع الكتابة فوق تعديل غيرك (VERSION_CONFLICT).
 * - لا إنجاز لطالب غائب أو مستأذن، ولا حضور مُسح وله إنجاز (HAS_ACHIEVEMENT)، ولا يوم في المستقبل.
 * - الصلاحية تُفحص في الموجّه (server/routers/daily.ts)؛ هنا القواعد والتخزين فقط. يعمل على MySQL وعلى
 *   SQLite في نسخة الجهاز بالاستعلامات نفسها.
 */
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import {
  centers,
  circles,
  dailyEntries,
  dailyRecords,
  dailyRecordTrash,
  students,
  teachers,
  users,
  type DailyEntry,
  type DailyRecord,
} from "../../drizzle/schema";
import {
  DAILY_ATTENDANCE,
  DAILY_ERROR_TYPES,
  DAILY_EVAL_CRITERIA,
  DAILY_TRASH_DAYS,
  addDays,
  daysBetween,
  gradeToScore,
  rangeSegments,
  segmentsToRange,
  weekdayOf,
  type DailyAttendance,
  type DailyDirection,
  type DailyErrorCode,
  type DailyKind,
  type DailyRange,
  type DailySegment,
} from "../../shared/dailyRecord";
import { getRiyadhDayKey } from "../../shared/dates";
import { getDb } from "./connection";
import { isSqliteDialect } from "./dialect";

/** خطأ مجال برمز يفهمه عميل السجل (رسالة الخطأ = الرمز). */
export class DailyError extends Error {
  constructor(readonly code: DailyErrorCode) {
    super(code);
    this.name = "DailyError";
  }
}
const fail = (code: DailyErrorCode): never => {
  throw new DailyError(code);
};

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;

async function db(): Promise<Db> {
  const d = await getDb();
  if (!d) throw new Error("DB not available");
  return d;
}

export const dailyToday = () => getRiyadhDayKey(new Date());
const iso = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString() : null;

/* ─────────── أشكال الاستجابة (كما في زِن) ─────────── */

export interface DayWorkOut {
  segments: DailySegment[];
  score: number | null;
  error_type: string | null;
  notes: string | null;
}
export interface LastWorkOut extends DailySegment {
  session_date: string;
}
export interface EvaluationOut {
  overall: number | null;
  tajweed: number | null;
  pronunciation: number | null;
  behavior: number | null;
}
export interface DayStudentOut {
  student_id: string;
  name: string;
  avatar: null;
  status: DailyAttendance | null;
  reason: string | null;
  version: number;
  member: boolean;
  note: string | null;
  evaluation: EvaluationOut | null;
  memorize: DayWorkOut | null;
  review: DayWorkOut | null;
  last_memorize: LastWorkOut | null;
  last_review: LastWorkOut | null;
  memorize_dir: DailyDirection;
  review_dir: DailyDirection;
  absences_30d: number;
}
export interface RecordHeadOut {
  id: string;
  status: DailyRecord["status"];
  version: number;
  notes?: string | null;
}

const P = { memorize: "mem", review: "rev" } as const;
type Prefix = (typeof P)[DailyKind];

function rangeOf(e: DailyEntry, kind: DailyKind): DailyRange | null {
  const p: Prefix = P[kind];
  const fromSurah = e[`${p}FromSurah`];
  const fromAyah = e[`${p}FromAyah`];
  const toSurah = e[`${p}ToSurah`];
  const toAyah = e[`${p}ToAyah`];
  if (
    fromSurah == null ||
    fromAyah == null ||
    toSurah == null ||
    toAyah == null
  )
    return null;
  return { fromSurah, fromAyah, toSurah, toAyah };
}

export function workOf(
  e: DailyEntry | undefined,
  kind: DailyKind
): DayWorkOut | null {
  if (!e) return null;
  const r = rangeOf(e, kind);
  if (!r) return null;
  const segments = rangeSegments(r);
  if (!segments.length) return null;
  const p: Prefix = P[kind];
  return {
    segments,
    score: gradeToScore(e[`${p}Grade`]),
    error_type: e[`${p}Error`] ?? "none",
    notes: e[`${p}Notes`] ?? null,
  };
}

export function evaluationOf(e: DailyEntry | undefined): EvaluationOut | null {
  if (!e) return null;
  const v = {
    overall: e.evalOverall ?? null,
    tajweed: e.evalTajweed ?? null,
    pronunciation: e.evalPronunciation ?? null,
    behavior: e.evalBehavior ?? null,
  };
  return Object.values(v).every(x => x == null) ? null : v;
}

const hasWork = (e: DailyEntry) =>
  rangeOf(e, "memorize") != null || rangeOf(e, "review") != null;

/* ─────────── قراءة ─────────── */

export async function getDailyCircle(circleId: number) {
  const d = await db();
  const [c] = await d
    .select({
      id: circles.id,
      name: circles.name,
      centerId: circles.centerId,
      schedule: circles.schedule,
      teacherName: teachers.name,
      centerName: centers.name,
      centerManagerId: centers.managerId,
    })
    .from(circles)
    .leftJoin(teachers, eq(teachers.id, circles.teacherId))
    .leftJoin(centers, eq(centers.id, circles.centerId))
    .where(and(eq(circles.id, circleId), isNull(circles.deletedAt)))
    .limit(1);
  return c ?? null;
}

export async function getDailyRecordById(id: number) {
  const [r] = await (
    await db()
  )
    .select()
    .from(dailyRecords)
    .where(eq(dailyRecords.id, id))
    .limit(1);
  return r ?? null;
}

async function recordAt(q: Q, circleId: number, date: string) {
  const [r] = await q
    .select()
    .from(dailyRecords)
    .where(
      and(
        eq(dailyRecords.circleId, circleId),
        eq(dailyRecords.recordDate, date)
      )
    )
    .limit(1);
  return r ?? null;
}

async function memberRows(q: Q, circleId: number) {
  return q
    .select({
      id: students.id,
      name: students.name,
      memorizeDir: students.memorizeDir,
      reviewDir: students.reviewDir,
    })
    .from(students)
    .where(
      and(
        eq(students.circleId, circleId),
        isNull(students.deletedAt),
        eq(students.isActive, true)
      )
    );
}

async function isMember(q: Q, circleId: number, studentId: number) {
  const [s] = await q
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.id, studentId),
        eq(students.circleId, circleId),
        isNull(students.deletedAt)
      )
    )
    .limit(1);
  return !!s;
}

/** آخر مقطع حفظ ومراجعة لكل طالب قبل اليوم (للاقتراح «من حيث توقّف»). */
async function lastWork(q: Q, ids: number[], before: string) {
  const out = new Map<
    number,
    { memorize: LastWorkOut | null; review: LastWorkOut | null }
  >();
  for (const id of ids) out.set(id, { memorize: null, review: null });
  if (!ids.length) return out;
  for (const kind of ["memorize", "review"] as const) {
    const col =
      kind === "memorize"
        ? dailyEntries.memFromSurah
        : dailyEntries.revFromSurah;
    const latest = await q
      .select({
        studentId: dailyEntries.studentId,
        date: sql<string>`max(${dailyEntries.recordDate})`,
      })
      .from(dailyEntries)
      .where(
        and(
          inArray(dailyEntries.studentId, ids),
          isNotNull(col),
          lt(dailyEntries.recordDate, before)
        )
      )
      .groupBy(dailyEntries.studentId);
    if (!latest.length) continue;
    const rows = await q
      .select()
      .from(dailyEntries)
      .where(
        and(
          inArray(
            dailyEntries.studentId,
            latest.map(l => l.studentId)
          ),
          inArray(
            dailyEntries.recordDate,
            Array.from(new Set(latest.map(l => String(l.date))))
          ),
          isNotNull(col)
        )
      );
    const want = new Map(latest.map(l => [l.studentId, String(l.date)]));
    for (const e of rows) {
      if (want.get(e.studentId) !== e.recordDate) continue;
      const segs = workOf(e, kind)?.segments;
      const last = segs?.[segs.length - 1];
      if (last)
        out.get(e.studentId)![kind] = { ...last, session_date: e.recordDate };
    }
  }
  return out;
}

async function absences(q: Q, circleId: number, date: string, ids: number[]) {
  const m = new Map<number, number>();
  if (!ids.length) return m;
  const rows = await q
    .select({ studentId: dailyEntries.studentId, n: sql<number>`count(*)` })
    .from(dailyEntries)
    .where(
      and(
        eq(dailyEntries.circleId, circleId),
        eq(dailyEntries.status, "absent"),
        inArray(dailyEntries.studentId, ids),
        gte(dailyEntries.recordDate, addDays(date, -29)),
        lte(dailyEntries.recordDate, date)
      )
    )
    .groupBy(dailyEntries.studentId);
  for (const r of rows) m.set(r.studentId, Number(r.n));
  return m;
}

async function studentRows(
  q: Q,
  circleId: number,
  date: string,
  only?: number[]
): Promise<DayStudentOut[]> {
  const members = await memberRows(q, circleId);
  const entries = await q
    .select()
    .from(dailyEntries)
    .where(
      and(
        eq(dailyEntries.circleId, circleId),
        eq(dailyEntries.recordDate, date)
      )
    );
  const byStudent = new Map(entries.map(e => [e.studentId, e]));
  const memberIds = new Set(members.map(m => m.id));
  let ids = Array.from(
    new Set([...members.map(m => m.id), ...entries.map(e => e.studentId)])
  );
  if (only) ids = ids.filter(id => only.includes(id));
  const extra = ids.filter(id => !memberIds.has(id));
  const others = extra.length
    ? await q
        .select({
          id: students.id,
          name: students.name,
          memorizeDir: students.memorizeDir,
          reviewDir: students.reviewDir,
        })
        .from(students)
        .where(inArray(students.id, extra))
    : [];
  const info = new Map([...members, ...others].map(s => [s.id, s]));
  const [last, abs] = await Promise.all([
    lastWork(q, ids, date),
    absences(q, circleId, date, ids),
  ]);
  const dir = (v: string | null | undefined): DailyDirection =>
    v === "backward" ? "backward" : "forward";
  return ids
    .map(id => {
      const e = byStudent.get(id);
      const s = info.get(id);
      return {
        student_id: String(id),
        name: s?.name ?? "",
        avatar: null,
        status: (e?.status ?? null) as DailyAttendance | null,
        reason: e?.reason ?? null,
        version: e?.version ?? 0,
        member: memberIds.has(id),
        note: e?.note ?? null,
        evaluation: evaluationOf(e),
        memorize: workOf(e, "memorize"),
        review: workOf(e, "review"),
        last_memorize: last.get(id)?.memorize ?? null,
        last_review: last.get(id)?.review ?? null,
        memorize_dir: dir(s?.memorizeDir),
        review_dir: dir(s?.reviewDir),
        absences_30d: abs.get(id) ?? 0,
      } satisfies DayStudentOut;
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "ar") ||
        Number(a.student_id) - Number(b.student_id)
    );
}

async function studentRow(q: Q, rec: DailyRecord, studentId: number) {
  const [row] = await studentRows(q, rec.circleId, rec.recordDate, [studentId]);
  return row;
}

async function userName(q: Q, id: number | null) {
  if (!id) return null;
  const [u] = await q
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return u?.name ?? null;
}

export async function dailySheet(
  circle: NonNullable<Awaited<ReturnType<typeof getDailyCircle>>>,
  date: string,
  access: { editor: boolean; canLock: boolean }
) {
  const d = await db();
  const today = dailyToday();
  const rec = await recordAt(d, circle.id, date);
  return {
    halaqa: {
      id: String(circle.id),
      name: circle.name,
      teacher_name: circle.teacherName ?? null,
    },
    date,
    today,
    can_edit: access.editor && date <= today,
    can_lock: access.canLock,
    record: rec
      ? {
          id: String(rec.id),
          status: rec.status,
          version: rec.version,
          notes: rec.notes ?? null,
          completed_at: iso(rec.completedAt),
          locked_at: iso(rec.lockedAt),
          completed_by_name: await userName(d, rec.completedBy ?? null),
        }
      : null,
    students: await studentRows(d, circle.id, date),
  };
}

export async function dailyWeek(circleId: number, to: string) {
  const from = addDays(to, -6);
  const rows = await (
    await db()
  )
    .select({ date: dailyRecords.recordDate, status: dailyRecords.status })
    .from(dailyRecords)
    .where(
      and(
        eq(dailyRecords.circleId, circleId),
        gte(dailyRecords.recordDate, from),
        lte(dailyRecords.recordDate, to)
      )
    );
  const m = new Map(rows.map(r => [r.date, r.status]));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    return { date, status: m.get(date) ?? null };
  });
}

/* ─────────── كتابة ─────────── */

const head = (r: DailyRecord, withNotes = false): RecordHeadOut => ({
  id: String(r.id),
  status: r.status,
  version: r.version,
  ...(withNotes ? { notes: r.notes ?? null } : {}),
});

/** يقفل السجل للكتابة (MySQL: FOR UPDATE؛ SQLite في الجهاز طلب واحد في كل مرة). */
async function lockRecord(tx: Tx, id: number) {
  const base = tx
    .select()
    .from(dailyRecords)
    .where(eq(dailyRecords.id, id))
    .limit(1);
  const [r] = isSqliteDialect() ? await base : await base.for("update");
  return r ?? null;
}

async function forWrite(tx: Tx, id: number, exclusive: boolean) {
  const rec = await lockRecord(tx, id);
  if (!rec) fail("RECORD_NOT_FOUND");
  if (rec!.status === "locked") fail("RECORD_LOCKED");
  if (rec!.status === "completed" && !exclusive) fail("RECORD_COMPLETED");
  return rec!;
}

async function entryFor(
  tx: Tx,
  rec: DailyRecord,
  studentId: number,
  version: number
) {
  if (!(await isMember(tx, rec.circleId, studentId)))
    fail("STUDENT_NOT_IN_HALAQA");
  const base = tx
    .select()
    .from(dailyEntries)
    .where(
      and(
        eq(dailyEntries.recordId, rec.id),
        eq(dailyEntries.studentId, studentId)
      )
    )
    .limit(1);
  const [e] = isSqliteDialect() ? await base : await base.for("update");
  if ((e?.version ?? 0) !== version) fail("VERSION_CONFLICT");
  return e ?? null;
}

async function writeEntry(
  tx: Tx,
  rec: DailyRecord,
  studentId: number,
  current: DailyEntry | null,
  set: Partial<typeof dailyEntries.$inferInsert>,
  by: number
) {
  if (current) {
    await tx
      .update(dailyEntries)
      .set({
        ...set,
        recordedBy: by,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(dailyEntries.id, current.id));
  } else {
    await tx.insert(dailyEntries).values({
      recordId: rec.id,
      circleId: rec.circleId,
      recordDate: rec.recordDate,
      studentId,
      recordedBy: by,
      version: 1,
      ...set,
    });
  }
}

export async function openDailyRecord(
  circleId: number,
  date: string,
  by: number
) {
  if (date > dailyToday()) fail("INVALID_DATE");
  const d = await db();
  let rec = await recordAt(d, circleId, date);
  if (!rec) {
    try {
      await d
        .insert(dailyRecords)
        .values({ circleId, recordDate: date, openedBy: by });
    } catch (error) {
      // فتحه غيرك في اللحظة نفسها: المفتاح الفريد يمنع التكرار ونعيد السجل القائم.
      if (!(await recordAt(d, circleId, date))) throw error;
    }
    rec = await recordAt(d, circleId, date);
  }
  return head(rec!);
}

export async function setDailyAttendance(
  recordId: number,
  studentId: number,
  status: DailyAttendance,
  reason: string | null,
  version: number,
  by: number
) {
  if (!DAILY_ATTENDANCE.includes(status)) fail("INVALID_STATUS");
  if (reason && reason.length > 300) fail("INVALID_REASON");
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, false);
    const e = await entryFor(tx, rec, studentId, version);
    if ((status === "absent" || status === "excused") && e && hasWork(e))
      fail("HAS_ACHIEVEMENT");
    const clean = reason?.trim() || null;
    const nextReason =
      status === "present"
        ? null
        : clean == null && e?.status === status
          ? (e?.reason ?? null)
          : clean;
    await writeEntry(tx, rec, studentId, e, { status, reason: nextReason }, by);
    return studentRow(tx, rec, studentId);
  });
}

export async function clearDailyAttendance(
  recordId: number,
  studentId: number,
  version: number,
  by: number
) {
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, false);
    const e = await entryFor(tx, rec, studentId, version);
    if (e && hasWork(e)) fail("HAS_ACHIEVEMENT");
    if (e)
      await writeEntry(
        tx,
        rec,
        studentId,
        e,
        { status: null, reason: null },
        by
      );
    return studentRow(tx, rec, studentId);
  });
}

export interface BulkRowIn {
  student: number;
  status: DailyAttendance | null;
  version: number;
}

/** «الجميع حاضر» و«الباقون غائبون» والتراجع عنهما: كل سطر بنسخته، والمرفوض يُذكر ولا يوقف البقية. */
export async function setDailyAttendanceBulk(
  recordId: number,
  rows: BulkRowIn[],
  by: number
) {
  if (!rows.length || rows.length > 300) fail("INVALID_ROWS");
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, false);
    const done: number[] = [];
    const skipped: Array<{ student: string; code: string }> = [];
    for (const row of rows) {
      try {
        if (row.status && !DAILY_ATTENDANCE.includes(row.status))
          fail("INVALID_STATUS");
        const e = await entryFor(tx, rec, row.student, row.version);
        if (
          row.status === null ||
          row.status === "absent" ||
          row.status === "excused"
        )
          if (e && hasWork(e)) fail("HAS_ACHIEVEMENT");
        if (row.status === null) {
          if (e)
            await writeEntry(
              tx,
              rec,
              row.student,
              e,
              { status: null, reason: null },
              by
            );
        } else {
          const reason =
            row.status === "present"
              ? null
              : e?.status === row.status
                ? (e?.reason ?? null)
                : null;
          await writeEntry(
            tx,
            rec,
            row.student,
            e,
            { status: row.status, reason },
            by
          );
        }
        done.push(row.student);
      } catch (error) {
        if (!(error instanceof DailyError)) throw error;
        skipped.push({ student: String(row.student), code: error.code });
      }
    }
    const list = done.length
      ? await studentRows(tx, rec.circleId, rec.recordDate, done)
      : [];
    return { students: list, skipped };
  });
}

export interface WorkIn {
  segments: DailySegment[];
  grade: number;
  error_type?: string | null;
  notes?: string | null;
  direction?: DailyDirection | null;
}
export interface EntryIn {
  memorize?: WorkIn | null;
  review?: WorkIn | null;
  evaluation?: Partial<
    Record<(typeof DAILY_EVAL_CRITERIA)[number], number | null>
  > | null;
  note?: string | null;
}

/** حفظ سطر الطالب: المفتاح الغائب لا يُمسّ، وnull يحذف (كما في save_daily_entry). */
export async function saveDailyEntry(
  recordId: number,
  studentId: number,
  payload: EntryIn,
  version: number,
  by: number
) {
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, false);
    const e = await entryFor(tx, rec, studentId, version);
    const set: Partial<typeof dailyEntries.$inferInsert> = {};
    for (const kind of ["memorize", "review"] as const) {
      if (!(kind in payload)) continue;
      const p: Prefix = P[kind];
      const part = payload[kind];
      if (part === null) {
        Object.assign(set, {
          [`${p}FromSurah`]: null,
          [`${p}FromAyah`]: null,
          [`${p}ToSurah`]: null,
          [`${p}ToAyah`]: null,
          [`${p}Grade`]: null,
          [`${p}Error`]: null,
          [`${p}Notes`]: null,
        });
        continue;
      }
      if (!part || !Array.isArray(part.segments)) fail("INVALID_RANGE");
      const range = segmentsToRange(part!.segments);
      if (!range) fail("INVALID_RANGE");
      if (e?.status === "absent" || e?.status === "excused")
        fail("STUDENT_NOT_PRESENT");
      if (!Number.isInteger(part!.grade) || part!.grade < 1 || part!.grade > 5)
        fail("INVALID_GRADE");
      const err = part!.error_type || "none";
      if (!(DAILY_ERROR_TYPES as readonly string[]).includes(err))
        fail("INVALID_ERROR_TYPE");
      const notes = part!.notes?.trim() || null;
      if (notes && notes.length > 1000) fail("INVALID_NOTES");
      if (
        part!.direction &&
        part!.direction !== "forward" &&
        part!.direction !== "backward"
      )
        fail("INVALID_DIRECTION");
      Object.assign(set, {
        [`${p}FromSurah`]: range!.fromSurah,
        [`${p}FromAyah`]: range!.fromAyah,
        [`${p}ToSurah`]: range!.toSurah,
        [`${p}ToAyah`]: range!.toAyah,
        [`${p}Grade`]: part!.grade,
        [`${p}Error`]: err,
        [`${p}Notes`]: notes,
      });
      // حاضر ضمناً إن سُجّل إنجاز ولم يُسجَّل الحضور بعد.
      if (!e?.status && !set.status) set.status = "present";
      if (part!.direction)
        await tx
          .update(students)
          .set(
            kind === "memorize"
              ? { memorizeDir: part!.direction }
              : { reviewDir: part!.direction }
          )
          .where(eq(students.id, studentId));
    }
    if ("evaluation" in payload) {
      const ev =
        payload.evaluation && typeof payload.evaluation === "object"
          ? payload.evaluation
          : {};
      for (const c of DAILY_EVAL_CRITERIA) {
        const v = ev[c];
        if (v != null && (!Number.isInteger(v) || v < 1 || v > 5))
          fail("INVALID_EVALUATION");
      }
      set.evalOverall = ev.overall ?? null;
      set.evalTajweed = ev.tajweed ?? null;
      set.evalPronunciation = ev.pronunciation ?? null;
      set.evalBehavior = ev.behavior ?? null;
    }
    if ("note" in payload) {
      const note = payload.note;
      if (note != null && typeof note !== "string") fail("INVALID_NOTES");
      if (note && note.length > 1000) fail("INVALID_NOTES");
      set.note = note?.trim() || null;
    }
    await writeEntry(tx, rec, studentId, e, set, by);
    return studentRow(tx, rec, studentId);
  });
}

export async function setDailyNotes(
  recordId: number,
  notes: string | null,
  version: number
) {
  if (notes && notes.length > 2000) fail("INVALID_NOTES");
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, true);
    if (rec.status !== "open") fail("RECORD_COMPLETED");
    if (rec.version !== version) fail("VERSION_CONFLICT");
    await tx
      .update(dailyRecords)
      .set({
        notes: notes?.trim() || null,
        version: rec.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(dailyRecords.id, rec.id));
    return head((await lockRecord(tx, rec.id))!, true);
  });
}

export async function completeDailyRecord(
  recordId: number,
  version: number,
  by: number
) {
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, true);
    if (rec.status !== "open") fail("RECORD_COMPLETED");
    if (rec.version !== version) fail("VERSION_CONFLICT");
    const members = new Set(
      (await memberRows(tx, rec.circleId)).map(m => m.id)
    );
    const marked = await tx
      .select({ studentId: dailyEntries.studentId })
      .from(dailyEntries)
      .where(
        and(eq(dailyEntries.recordId, rec.id), isNotNull(dailyEntries.status))
      );
    if (!marked.some(m => members.has(m.studentId))) fail("NO_ATTENDANCE");
    await tx
      .update(dailyRecords)
      .set({
        status: "completed",
        completedBy: by,
        completedAt: new Date(),
        version: rec.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(dailyRecords.id, rec.id));
    return head((await lockRecord(tx, rec.id))!);
  });
}

export async function reopenDailyRecord(recordId: number, version: number) {
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, true);
    if (rec.status !== "completed") fail("INVALID_TRANSITION");
    if (rec.version !== version) fail("VERSION_CONFLICT");
    await tx
      .update(dailyRecords)
      .set({
        status: "open",
        completedBy: null,
        completedAt: null,
        version: rec.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(dailyRecords.id, rec.id));
    return head((await lockRecord(tx, rec.id))!);
  });
}

export async function lockDailyRecord(
  recordId: number,
  version: number,
  by: number
) {
  return (await db()).transaction(async tx => {
    const rec = await lockRecord(tx, recordId);
    if (!rec) fail("RECORD_NOT_FOUND");
    if (rec!.status === "locked") fail("RECORD_LOCKED");
    if (rec!.status !== "completed") fail("INVALID_TRANSITION");
    if (rec!.version !== version) fail("VERSION_CONFLICT");
    await tx
      .update(dailyRecords)
      .set({
        status: "locked",
        lockedBy: by,
        lockedAt: new Date(),
        version: rec!.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(dailyRecords.id, rec!.id));
    return head((await lockRecord(tx, rec!.id))!);
  });
}

/* ─────────── السجلات السابقة والسلّة ─────────── */

function countsOf(entries: DailyEntry[]) {
  const c = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    memorized: 0,
    reviewed: 0,
  };
  for (const e of entries) {
    if (e.status) c[e.status]++;
    if (rangeOf(e, "memorize")) c.memorized++;
    if (rangeOf(e, "review")) c.reviewed++;
  }
  return c;
}

export async function dailyHistory(
  circleId: number,
  before: string | null,
  limit: number,
  editor: boolean
) {
  const d = await db();
  const lim = Math.min(Math.max(limit || 30, 1), 60);
  const recs = await d
    .select()
    .from(dailyRecords)
    .where(
      and(
        eq(dailyRecords.circleId, circleId),
        before ? lt(dailyRecords.recordDate, before) : undefined
      )
    )
    .orderBy(desc(dailyRecords.recordDate))
    .limit(lim);
  if (!recs.length) return [];
  const entries = await d
    .select()
    .from(dailyEntries)
    .where(
      inArray(
        dailyEntries.recordId,
        recs.map(r => r.id)
      )
    );
  const today = dailyToday();
  return recs.map(r => ({
    id: String(r.id),
    date: r.recordDate,
    status: r.status,
    version: r.version,
    notes: r.notes ?? null,
    completed_at: iso(r.completedAt),
    updated_at: iso(r.updatedAt)!,
    ...countsOf(entries.filter(e => e.recordId === r.id)),
    editable: editor && r.status !== "locked" && r.recordDate <= today,
  }));
}

interface TrashSnapshot {
  record: Omit<
    DailyRecord,
    "createdAt" | "updatedAt" | "completedAt" | "lockedAt"
  > & {
    completedAt: string | null;
    lockedAt: string | null;
  };
  entries: Array<Omit<DailyEntry, "id" | "createdAt" | "updatedAt">>;
}

export async function deleteDailyRecord(
  recordId: number,
  version: number,
  by: number
) {
  return (await db()).transaction(async tx => {
    const rec = await forWrite(tx, recordId, true);
    if (rec.version !== version) fail("VERSION_CONFLICT");
    if (rec.recordDate > dailyToday()) fail("INVALID_DATE");
    const entries = await tx
      .select()
      .from(dailyEntries)
      .where(eq(dailyEntries.recordId, rec.id));
    const counts = countsOf(entries);
    const snapshot: TrashSnapshot = {
      record: {
        ...rec,
        completedAt: iso(rec.completedAt),
        lockedAt: iso(rec.lockedAt),
      },
      entries: entries.map(
        ({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest
      ),
    };
    await tx.insert(dailyRecordTrash).values({
      circleId: rec.circleId,
      recordDate: rec.recordDate,
      snapshot: JSON.stringify(snapshot),
      attendanceCount:
        counts.present + counts.late + counts.absent + counts.excused,
      workCount: entries.filter(hasWork).length,
      deletedBy: by,
    });
    const [trash] = await tx
      .select({ id: dailyRecordTrash.id })
      .from(dailyRecordTrash)
      .where(
        and(
          eq(dailyRecordTrash.circleId, rec.circleId),
          eq(dailyRecordTrash.recordDate, rec.recordDate)
        )
      )
      .orderBy(desc(dailyRecordTrash.id))
      .limit(1);
    await tx.delete(dailyEntries).where(eq(dailyEntries.recordId, rec.id));
    await tx.delete(dailyRecords).where(eq(dailyRecords.id, rec.id));
    return {
      id: String(rec.id),
      date: rec.recordDate,
      deleted: true,
      trash_id: trash ? String(trash.id) : undefined,
    };
  });
}

const trashCutoff = () => new Date(Date.now() - DAILY_TRASH_DAYS * 86_400_000);

export async function dailyTrashList(circleId: number) {
  const d = await db();
  const rows = await d
    .select()
    .from(dailyRecordTrash)
    .where(
      and(
        eq(dailyRecordTrash.circleId, circleId),
        isNull(dailyRecordTrash.restoredAt),
        gte(dailyRecordTrash.deletedAt, trashCutoff())
      )
    )
    .orderBy(desc(dailyRecordTrash.deletedAt));
  if (!rows.length) return [];
  const taken = await d
    .select({ date: dailyRecords.recordDate })
    .from(dailyRecords)
    .where(
      and(
        eq(dailyRecords.circleId, circleId),
        inArray(
          dailyRecords.recordDate,
          rows.map(r => r.recordDate)
        )
      )
    );
  const busy = new Set(taken.map(t => t.date));
  return rows.map(r => ({
    id: String(r.id),
    date: r.recordDate,
    deleted_at: iso(r.deletedAt)!,
    expires_at: new Date(
      new Date(r.deletedAt).getTime() + DAILY_TRASH_DAYS * 86_400_000
    ).toISOString(),
    attendance: r.attendanceCount,
    sessions: r.workCount,
    restorable: !busy.has(r.recordDate),
  }));
}

export async function getDailyTrash(id: number) {
  const [t] = await (
    await db()
  )
    .select()
    .from(dailyRecordTrash)
    .where(eq(dailyRecordTrash.id, id))
    .limit(1);
  return t ?? null;
}

export async function restoreDailyRecord(trashId: number) {
  return (await db()).transaction(async tx => {
    const [t] = await tx
      .select()
      .from(dailyRecordTrash)
      .where(eq(dailyRecordTrash.id, trashId))
      .limit(1);
    if (!t || t.restoredAt || new Date(t.deletedAt) < trashCutoff())
      fail("NOT_FOUND");
    if (await recordAt(tx, t!.circleId, t!.recordDate)) fail("RECORD_EXISTS");
    const snap = JSON.parse(t!.snapshot) as TrashSnapshot;
    const r = snap.record;
    await tx.insert(dailyRecords).values({
      circleId: t!.circleId,
      recordDate: t!.recordDate,
      status: r.status,
      notes: r.notes,
      version: (r.version ?? 1) + 1,
      openedBy: r.openedBy,
      completedBy: r.completedBy,
      completedAt: r.completedAt ? new Date(r.completedAt) : null,
      lockedBy: r.lockedBy,
      lockedAt: r.lockedAt ? new Date(r.lockedAt) : null,
    });
    const rec = (await recordAt(tx, t!.circleId, t!.recordDate))!;
    for (const e of snap.entries)
      await tx.insert(dailyEntries).values({
        ...e,
        recordId: rec.id,
        circleId: rec.circleId,
        recordDate: rec.recordDate,
      });
    await tx
      .update(dailyRecordTrash)
      .set({ restoredAt: new Date() })
      .where(eq(dailyRecordTrash.id, t!.id));
    return { ...head(rec), date: rec.recordDate };
  });
}

/* ─────────── الطالب ─────────── */

export async function studentDailyOverview(studentId: number) {
  const d = await db();
  const today = dailyToday();
  const recent = await d
    .select()
    .from(dailyEntries)
    .where(
      and(
        eq(dailyEntries.studentId, studentId),
        gte(dailyEntries.recordDate, addDays(today, -30)),
        lte(dailyEntries.recordDate, today)
      )
    );
  const attendance = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const e of recent) if (e.status) attendance[e.status]++;
  const all = await d
    .select()
    .from(dailyEntries)
    .where(eq(dailyEntries.studentId, studentId))
    .orderBy(desc(dailyEntries.recordDate))
    .limit(400);
  const lastOf = (kind: DailyKind) => {
    for (const e of all) {
      const segs = workOf(e, kind)?.segments;
      if (segs?.length)
        return { ...segs[segs.length - 1], session_date: e.recordDate };
    }
    return null;
  };
  const evalEntry = all.find(e => evaluationOf(e));
  return {
    attendance,
    last_memorize: lastOf("memorize"),
    last_review: lastOf("review"),
    last_evaluation: evalEntry
      ? { ...evaluationOf(evalEntry)!, session_date: evalEntry.recordDate }
      : null,
    notes: all
      .filter(e => e.note)
      .slice(0, 5)
      .map(e => ({ session_date: e.recordDate, note: e.note! })),
  };
}

/** أيام الطالب في نطاق (لملف الطالب وولي الأمر): الأحدث أولاً. */
export async function studentDailyDays(studentId: number, limit = 60) {
  const d = await db();
  const rows = await d
    .select()
    .from(dailyEntries)
    .where(eq(dailyEntries.studentId, studentId))
    .orderBy(desc(dailyEntries.recordDate))
    .limit(Math.min(Math.max(limit, 1), 400));
  return rows.map(e => ({
    date: e.recordDate,
    circleId: e.circleId,
    status: e.status,
    reason: e.reason,
    note: e.note,
    evaluation: evaluationOf(e),
    memorize: workOf(e, "memorize"),
    review: workOf(e, "review"),
  }));
}

/* ─────────── التقارير (halaqa_report_data) ─────────── */

export async function dailyReportData(
  circle: NonNullable<Awaited<ReturnType<typeof getDailyCircle>>>,
  q: {
    from: string;
    to: string;
    students?: number[] | null;
    weekdays?: number[] | null;
    history?: boolean;
  }
) {
  if (q.from > q.to || daysBetween(q.from, q.to) > 731) fail("INVALID_RANGE");
  if (q.students && q.students.length > 300) fail("INVALID_PAYLOAD");
  if (q.weekdays?.some(w => !Number.isInteger(w) || w < 0 || w > 6))
    fail("INVALID_PAYLOAD");
  const d = await db();
  const wd =
    q.weekdays?.length && q.weekdays.length < 7 ? new Set(q.weekdays) : null;
  const okDay = (day: string) => !wd || wd.has(weekdayOf(day));
  const members = await memberRows(d, circle.id);
  const memberIds = new Set(members.map(m => m.id));
  const entries = (
    await d
      .select()
      .from(dailyEntries)
      .where(
        and(
          eq(dailyEntries.circleId, circle.id),
          gte(dailyEntries.recordDate, q.from),
          lte(dailyEntries.recordDate, q.to)
        )
      )
  ).filter(e => okDay(e.recordDate));
  let ids = Array.from(
    new Set([...memberIds, ...entries.map(e => e.studentId)])
  );
  if (q.students?.length) ids = ids.filter(id => q.students!.includes(id));
  const idSet = new Set(ids);
  const people = ids.length
    ? await d
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(inArray(students.id, ids))
    : [];
  const days = (
    await d
      .select()
      .from(dailyRecords)
      .where(
        and(
          eq(dailyRecords.circleId, circle.id),
          gte(dailyRecords.recordDate, q.from),
          lte(dailyRecords.recordDate, q.to)
        )
      )
      .orderBy(dailyRecords.recordDate)
  ).filter(r => okDay(r.recordDate));
  let history: Array<DailySegment & { student_id: string; date: string }> = [];
  if (q.history && ids.length) {
    const rows = await d
      .select()
      .from(dailyEntries)
      .where(
        and(
          inArray(dailyEntries.studentId, ids),
          isNotNull(dailyEntries.memFromSurah),
          lte(dailyEntries.recordDate, q.to)
        )
      )
      .orderBy(dailyEntries.recordDate)
      .limit(20000);
    history = rows.flatMap(e =>
      (workOf(e, "memorize")?.segments ?? []).map(s => ({
        ...s,
        student_id: String(e.studentId),
        date: e.recordDate,
      }))
    );
  }
  return {
    halaqa: {
      id: String(circle.id),
      name: circle.name,
      teacher_name: circle.teacherName ?? null,
      center_name: circle.centerName ?? null,
    },
    from: q.from,
    to: q.to,
    today: dailyToday(),
    generated_at: new Date().toISOString(),
    schedule: [] as { weekday: number; start: string; end: string }[],
    students: people
      .map(p => ({
        id: String(p.id),
        name: p.name,
        member: memberIds.has(p.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar")),
    days: days.map(r => ({
      date: r.recordDate,
      status: r.status,
      notes: r.notes ?? null,
    })),
    rows: entries
      .filter(e => idSet.has(e.studentId))
      .sort(
        (a, b) =>
          a.recordDate.localeCompare(b.recordDate) || a.studentId - b.studentId
      )
      .map(e => ({
        date: e.recordDate,
        student_id: String(e.studentId),
        status: e.status ?? null,
        reason: e.reason ?? null,
        note: e.note ?? null,
        evaluation: evaluationOf(e),
        memorize: workOf(e, "memorize"),
        review: workOf(e, "review"),
      })),
    history,
  };
}

/* ─────────── هوية التقرير للمركز ─────────── */

export async function getReportIdentity(centerId: number) {
  const [c] = await (
    await db()
  )
    .select({ v: centers.reportIdentity })
    .from(centers)
    .where(eq(centers.id, centerId))
    .limit(1);
  if (!c?.v) return null;
  try {
    return JSON.parse(c.v) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function setReportIdentity(
  centerId: number,
  identity: Record<string, unknown> | null
) {
  const text = identity ? JSON.stringify(identity) : null;
  if (text && text.length > 400_000) fail("INVALID_PAYLOAD");
  await (
    await db()
  )
    .update(centers)
    .set({ reportIdentity: text })
    .where(eq(centers.id, centerId));
}

/* ─────────── لوحات المتابعة ─────────── */

/** ملخص أيام مجموعة حلقات في نطاق (للوحة المعلم والمركز). */
export async function dailyEntriesForCircles(
  circleIds: number[],
  from: string,
  to: string
) {
  if (!circleIds.length) return [];
  return (await db())
    .select()
    .from(dailyEntries)
    .where(
      and(
        inArray(dailyEntries.circleId, circleIds),
        gte(dailyEntries.recordDate, from),
        lte(dailyEntries.recordDate, to)
      )
    );
}

export async function dailyRecordsForCircles(
  circleIds: number[],
  from: string,
  to: string
) {
  if (!circleIds.length) return [];
  return (await db())
    .select()
    .from(dailyRecords)
    .where(
      and(
        inArray(dailyRecords.circleId, circleIds),
        gte(dailyRecords.recordDate, from),
        lte(dailyRecords.recordDate, to)
      )
    );
}
