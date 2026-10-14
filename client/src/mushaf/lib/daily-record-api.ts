/**
 * السجل اليومي — نداءات خادم ترتيل (موجّه daily.* في server/routers/daily.ts) بالأشكال نفسها التي
 * تستعملها شاشات السجل المنقولة من زِن. كل كتابة يتحقق فيها الخادم من الصلاحية ورقم النسخة.
 */
import { mushafApi } from "@/mushaf/compat/api";
import { rememberReason } from "@/mushaf/lib/last-reason";
import type {
  AttendanceStatus,
  DaySheet,
  DayStudent,
  ErrorType,
  Evaluation,
  RangeDirection,
  RecordStatus,
  Segment,
} from "@/mushaf/lib/daily-record";

export interface WorkPayload {
  segments: Segment[];
  grade: number;
  error_type: ErrorType;
  notes: string | null;
  /** اتجاه الطالب (يُحفظ له في حلقته، 1.14.0). */
  direction?: RangeDirection;
}
/** المفتاح الغائب لا يُمسّ على الخادم؛ null يحذف. */
export interface EntryPayload {
  memorize?: WorkPayload | null;
  review?: WorkPayload | null;
  evaluation?: Evaluation | null;
  note?: string | null;
}
export interface RecordHead {
  id: string;
  status: RecordStatus;
  version: number;
  notes?: string | null;
}

/** الخادم يعيد الأشكال نفسها التي تصفها الأنواع هنا (server/data/daily-record.ts). */
async function call<T>(p: Promise<unknown>): Promise<T> {
  return (await p) as T;
}
const api = () => mushafApi().daily;

export const fetchDailySheet = (halaqa: string, date: string) =>
  call<DaySheet>(api().sheet.query({ halaqa, date }));

export const openDailyRecord = (halaqa: string, date: string) =>
  call<RecordHead>(api().open.mutate({ halaqa, date }));

export const setDailyAttendance = (
  record: string,
  student: string,
  status: AttendanceStatus,
  reason: string | null,
  version: number
) => {
  // 1.19.0: آخر سبب للطالب يُقترح في المرة القادمة (src/lib/last-reason.ts).
  if (reason && (status === "absent" || status === "excused"))
    rememberReason(student, reason);
  return call<DayStudent>(
    api().setAttendance.mutate({ record, student, status, reason, version })
  );
};

/** مسح حالة حضور سُجّلت خطأً (DR-16). */
export const clearDailyAttendance = (
  record: string,
  student: string,
  version: number
) =>
  call<DayStudent>(api().clearAttendance.mutate({ record, student, version }));

export interface BulkRow {
  student: string;
  /** null = مسح الحضور (للتراجع). */
  status: AttendanceStatus | null;
  version: number;
}
export interface BulkResult {
  students: DayStudent[];
  skipped: Array<{ student: string; code: string }>;
}
/** «الجميع حاضر» و«الباقون غائبون» والتراجع عنهما في نداء واحد (DR-05). */
export const setDailyAttendanceBulk = (record: string, rows: BulkRow[]) =>
  call<BulkResult>(api().setAttendanceBulk.mutate({ record, rows }));

export interface WeekDay {
  date: string;
  status: RecordStatus | null;
}
/** حالة سجل كل يوم من الأيام السبعة المنتهية بـto (DR-07). */
export const fetchDailyWeek = async (halaqa: string, to: string) =>
  (await call<WeekDay[] | null>(api().week.query({ halaqa, to }))) ?? [];

export const saveDailyEntry = (
  record: string,
  student: string,
  payload: EntryPayload,
  version: number
) =>
  call<DayStudent>(
    api().saveEntry.mutate({
      record,
      student,
      version,
      payload: payload as never,
    })
  );

export const setDailyNotes = (
  record: string,
  notes: string | null,
  version: number
) => call<RecordHead>(api().setNotes.mutate({ record, notes, version }));

export const completeDailyRecord = (record: string, version: number) =>
  call<RecordHead>(api().complete.mutate({ record, version }));

export const reopenDailyRecord = (record: string, version: number) =>
  call<RecordHead>(api().reopen.mutate({ record, version }));

export const lockDailyRecord = (record: string, version: number) =>
  call<RecordHead>(api().lock.mutate({ record, version }));

/** يوم في قائمة السجلات (DR-30): الأحدث أولاً بملخصه، وeditable لمدير الحلقة داخل النافذة. */
export interface HistoryDay {
  id: string;
  date: string;
  status: RecordStatus;
  version: number;
  notes: string | null;
  completed_at: string | null;
  updated_at: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  memorized: number;
  reviewed: number;
  editable: boolean;
}
export const fetchDailyHistory = async (
  halaqa: string,
  before: string | null = null,
  limit = 30
) =>
  (await call<HistoryDay[] | null>(
    api().history.query({ halaqa, before, limit })
  )) ?? [];

/**
 * حذف سجل يوم كاملاً (DR-31): الحضور والتسميعات وأسطر الطلاب، وتعود بطاقات المراجعة كما كانت.
 * منذ 1.14.0 تُحفظ لقطة اليوم في سلّة المحذوفات 30 يوماً (trash_id) ويُستعاد بـrestoreDailyRecord.
 */
export const deleteDailyRecord = (record: string, version: number) =>
  call<{ id: string; date: string; deleted: boolean; trash_id?: string }>(
    api().delete.mutate({ record, version })
  );

/** يوم في سلّة المحذوفات (آخر 30 يوماً). restorable = false إن أُنشئ لليوم نفسه سجل جديد بعده. */
export interface TrashDay {
  id: string;
  date: string;
  deleted_at: string;
  expires_at: string;
  attendance: number;
  sessions: number;
  restorable: boolean;
}
export const fetchDailyTrash = async (halaqa: string) =>
  (await call<TrashDay[] | null>(api().trashList.query({ halaqa }))) ?? [];

export const restoreDailyRecord = (trash: string) =>
  call<RecordHead & { date: string }>(api().restore.mutate({ trash }));

export interface StudentDailyOverview {
  attendance: {
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  last_memorize: (Segment & { session_date: string }) | null;
  last_review: (Segment & { session_date: string }) | null;
  last_evaluation: (Evaluation & { session_date: string }) | null;
  notes: Array<{ session_date: string; note: string }>;
}
export const fetchStudentDailyOverview = (student: string) =>
  call<StudentDailyOverview>(api().studentOverview.query({ student }));

/* ─────────── صندوق الإرسال بلا اتصال ─────────── */

/**
 * عنصر لكل (سجل، طالب): آخر حضور وآخر حفظ مدموجان، ورقم النسخة التي بُني عليها التعديل.
 * عند الإرسال يُرفض العنصر برسالة تعارض إن عدّل غيرك السطر في الأثناء، ولا يُكتب فوقه بصمت.
 */
export interface DailyOutboxItem {
  record: string;
  student: string;
  halaqa: string;
  date: string;
  version: number;
  /** status = null: مسح الحضور. */
  attendance?: { status: AttendanceStatus | null; reason: string | null };
  entry?: EntryPayload;
  queued_at: string;
}
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const KEY = "zen.daily.outbox";

function store(): Store | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readDailyOutbox(s: Store | null = store()): DailyOutboxItem[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s.getItem(KEY) ?? "[]") as DailyOutboxItem[];
    return Array.isArray(v) ? v.filter(x => x && x.record && x.student) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: DailyOutboxItem[], s: Store | null) {
  if (!s) return;
  if (items.length) s.setItem(KEY, JSON.stringify(items));
  else s.removeItem(KEY);
}

/** يدمج التعديل مع المعلّق للطالب نفسه (النسخة الأساس تبقى نسخة أول تعديل). */
export function queueDaily(
  item: Omit<DailyOutboxItem, "queued_at">,
  s: Store | null = store(),
  now = new Date()
) {
  const all = readDailyOutbox(s);
  const i = all.findIndex(
    x => x.record === item.record && x.student === item.student
  );
  const prev = i >= 0 ? all[i] : null;
  const merged: DailyOutboxItem = {
    ...item,
    version: prev ? prev.version : item.version,
    attendance: item.attendance ?? prev?.attendance,
    entry:
      prev?.entry || item.entry ? { ...prev?.entry, ...item.entry } : undefined,
    queued_at: now.toISOString(),
  };
  if (i >= 0) all[i] = merged;
  else all.push(merged);
  writeOutbox(all, s);
}

export interface FlushResult {
  sent: number;
  rejected: Array<{ item: DailyOutboxItem; error: unknown }>;
}

interface FlushApi {
  setDailyAttendance: typeof setDailyAttendance;
  saveDailyEntry: typeof saveDailyEntry;
  clearDailyAttendance?: typeof clearDailyAttendance;
  openDailyRecord?: typeof openDailyRecord;
}

/**
 * يرسل المعلّق بالترتيب؛ خطأ الشبكة يُبقي العنصر، ورفض الخادم يُعاد مع سببه. السجل المحلي (يوم فُتح دون
 * اتصال، daily-offline.ts) يُفتح على الخادم مرة لكل يوم، ويُحفظ ما فُتح في `resolved` لصندوق السجل.
 */
export async function flushDailyOutbox(
  isNetwork: (e: unknown) => boolean,
  api: FlushApi = {
    setDailyAttendance,
    saveDailyEntry,
    clearDailyAttendance,
    openDailyRecord,
  },
  s: Store | null = store(),
  resolved: Map<string, RecordHead> = new Map()
): Promise<FlushResult> {
  const keep: DailyOutboxItem[] = [];
  const rejected: FlushResult["rejected"] = [];
  let sent = 0;
  const snapshot = readDailyOutbox(s);
  for (const original of snapshot) {
    let item = original;
    let version = item.version;
    let pending: DailyOutboxItem = item;
    try {
      if (item.record.startsWith("local:")) {
        let head = resolved.get(item.record);
        if (!head) {
          head = await (api.openDailyRecord ?? openDailyRecord)(
            item.halaqa,
            item.date
          );
          resolved.set(item.record, head);
        }
        item = { ...item, record: head.id };
        pending = item;
      }
      if (item.attendance) {
        const { status, reason } = item.attendance;
        const row = status
          ? await api.setDailyAttendance(
              item.record,
              item.student,
              status,
              reason,
              version
            )
          : await (api.clearDailyAttendance ?? clearDailyAttendance)(
              item.record,
              item.student,
              version
            );
        version = row.version;
        pending = { ...item, attendance: undefined, version };
      }
      if (item.entry)
        await api.saveDailyEntry(
          item.record,
          item.student,
          item.entry,
          version
        );
      sent++;
    } catch (e) {
      if (isNetwork(e)) keep.push(pending);
      else rejected.push({ item: pending, error: e });
    }
  }
  // ما أُضيف أثناء الإرسال (لمسة جديدة) يبقى، ويحلّ محلّ المحفوظ للطالب نفسه لأنه مدموج معه.
  const same = (a: DailyOutboxItem, b: DailyOutboxItem) =>
    a.record === b.record &&
    a.student === b.student &&
    a.queued_at === b.queued_at;
  const fresh = readDailyOutbox(s).filter(x => !snapshot.some(o => same(o, x)));
  const key = (x: DailyOutboxItem) => `${x.halaqa}|${x.date}|${x.student}`;
  const freshKeys = new Set(fresh.map(key));
  writeOutbox([...keep.filter(x => !freshKeys.has(key(x))), ...fresh], s);
  return { sent, rejected };
}
