import { eq } from "drizzle-orm";
import { quranReadingStates } from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * حالة القراءة في قسم المصحف (منقول من زِن: sync_quran_state). الجهاز يرسل ما تغيّر مع وقت تعديله،
 * ويُحفظ الأحدث لكل حقل على حدة ثم تُعاد الحالة كاملة. حقل بلا وقت قراءة فقط، ووقت في المستقبل
 * (ساعة الجهاز متقدّمة) يُقصّ إلى الآن.
 */
export const READING_STATE_FIELDS = [
  "bookmarks",
  "khatmah",
  "history",
] as const;
export type ReadingStateField = (typeof READING_STATE_FIELDS)[number];

/** حدود الحجم كما في زِن: العلامات حتى ٢٠٠٠ تقريباً، والسجل ٤٠ موضعاً وأيام القراءة. */
export const READING_STATE_LIMITS: Record<ReadingStateField, number> = {
  bookmarks: 400_000,
  khatmah: 50_000,
  history: 100_000,
};
const SHAPES: Record<ReadingStateField, "array" | "object"> = {
  bookmarks: "array",
  khatmah: "object",
  history: "object",
};

export type ReadingStateInput = Partial<Record<ReadingStateField, unknown>> &
  Partial<Record<`${ReadingStateField}At`, string | null | undefined>>;

export type ReadingStateResult = Record<ReadingStateField, unknown> &
  Record<`${ReadingStateField}_at`, string | null>;

export class InvalidReadingStateError extends Error {
  constructor() {
    super("INVALID_STATE");
  }
}

function shapeOk(field: ReadingStateField, value: unknown): boolean {
  if (SHAPES[field] === "array") return Array.isArray(value);
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseStored(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

const atColumn = {
  bookmarks: "bookmarksAt",
  khatmah: "khatmahAt",
  history: "historyAt",
} as const;

/** يدمج ما أرسله الجهاز ويعيد الحالة بعد الدمج. */
export async function syncQuranReadingState(
  userId: number,
  input: ReadingStateInput,
  now: Date = new Date()
): Promise<ReadingStateResult> {
  const incoming: Partial<
    Record<ReadingStateField, { value: string; at: string }>
  > = {};
  for (const field of READING_STATE_FIELDS) {
    const atRaw = input[`${field}At`];
    if (atRaw === undefined || atRaw === null) continue;
    const atMs = Date.parse(atRaw);
    const value = input[field];
    if (!Number.isFinite(atMs) || !shapeOk(field, value))
      throw new InvalidReadingStateError();
    const json = JSON.stringify(value);
    if (new TextEncoder().encode(json).length > READING_STATE_LIMITS[field])
      throw new InvalidReadingStateError();
    incoming[field] = {
      value: json,
      at: new Date(Math.min(atMs, now.getTime())).toISOString(),
    };
  }

  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [current] = await db
    .select()
    .from(quranReadingStates)
    .where(eq(quranReadingStates.userId, userId))
    .limit(1);

  const next = {
    bookmarks: current?.bookmarks ?? null,
    bookmarksAt: current?.bookmarksAt ?? null,
    khatmah: current?.khatmah ?? null,
    khatmahAt: current?.khatmahAt ?? null,
    history: current?.history ?? null,
    historyAt: current?.historyAt ?? null,
  };
  let changed = false;
  for (const field of READING_STATE_FIELDS) {
    const item = incoming[field];
    if (!item) continue;
    const storedAt = next[atColumn[field]];
    if (storedAt && Date.parse(item.at) <= Date.parse(storedAt)) continue;
    next[field] = item.value;
    next[atColumn[field]] = item.at;
    changed = true;
  }

  if (changed) {
    await db
      .insert(quranReadingStates)
      .values({ userId, ...next, updatedAt: now })
      .onDuplicateKeyUpdate({ set: { ...next, updatedAt: now } });
  }

  return {
    bookmarks: parseStored(next.bookmarks),
    bookmarks_at: next.bookmarksAt,
    khatmah: parseStored(next.khatmah),
    khatmah_at: next.khatmahAt,
    history: parseStored(next.history),
    history_at: next.historyAt,
  };
}
