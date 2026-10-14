import { and, asc, eq, lte } from "drizzle-orm";
import { quranReviewCards } from "../../drizzle/schema";
import { getRiyadhDayKey } from "../../shared/dates";
import { getDb } from "./connection";

/**
 * المراجعة المتباعدة لقسم المصحف (منقولة من زِن: apply_review وsm2_quality). «أتقنتُها» في وضع الحفظ
 * مراجعة ذاتية بدرجة 95 تنشئ كرت المقطع أو تحدّثه بصيغة SM-2 الأصلية.
 */

/** الدرجة (0..100) إلى جودة SM-2 (0..5). */
export function sm2Quality(score: number | null | undefined): number {
  if (score === null || score === undefined) return 3;
  if (score >= 95) return 5;
  if (score >= 85) return 4;
  if (score >= 70) return 3;
  if (score >= 55) return 2;
  if (score >= 35) return 1;
  return 0;
}

export type ReviewCardState = {
  easeHundredths: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
};

/** خطوة SM-2: السهولة بين 1.3 و3.0، والفاصل 1 ثم 4 ثم الفاصل × السهولة، بسقف سنة. */
export function nextReviewState(
  card: ReviewCardState | null,
  score: number
): ReviewCardState {
  const q = sm2Quality(score);
  let ease = (card?.easeHundredths ?? 250) / 100;
  let reps = card?.repetitions ?? 0;
  let lapses = card?.lapses ?? 0;
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ease = Math.min(3, Math.max(1.3, Math.round(ease * 100) / 100));
  let interval: number;
  if (q < 3) {
    reps = 0;
    lapses += 1;
    interval = 1;
  } else {
    reps += 1;
    interval =
      reps === 1
        ? 1
        : reps === 2
          ? 4
          : Math.max(1, Math.round((card?.intervalDays || 1) * ease));
    interval = Math.min(interval, 365);
  }
  return {
    easeHundredths: Math.round(ease * 100),
    intervalDays: interval,
    repetitions: reps,
    lapses,
  };
}

/** يوم بعد `days` يوماً من `from` بتوقيت المنصة. */
export function addDaysKey(from: Date, days: number): string {
  const [y, m, d] = getRiyadhDayKey(from).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export async function applyQuranReview(input: {
  userId: number;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  score: number;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = input.now ?? new Date();
  const where = and(
    eq(quranReviewCards.userId, input.userId),
    eq(quranReviewCards.surahNumber, input.surahNumber),
    eq(quranReviewCards.fromAyah, input.fromAyah),
    eq(quranReviewCards.toAyah, input.toAyah)
  );
  const [card] = await db.select().from(quranReviewCards).where(where).limit(1);
  const next = nextReviewState(card ?? null, input.score);
  const dueDate = addDaysKey(now, next.intervalDays);
  const values = {
    ...next,
    lastScore: input.score,
    lastReviewedAt: now,
    dueDate,
    updatedAt: now,
  };
  await db
    .insert(quranReviewCards)
    .values({
      userId: input.userId,
      surahNumber: input.surahNumber,
      fromAyah: input.fromAyah,
      toAyah: input.toAyah,
      ...values,
    })
    .onDuplicateKeyUpdate({ set: values });
  return {
    due_date: dueDate,
    interval_days: next.intervalDays,
    ease: next.easeHundredths / 100,
    repetitions: next.repetitions,
  };
}

/** المراجعات المستحقة اليوم أو قبله، الأقدم أولاً. */
export async function getDueQuranReviews(
  userId: number,
  now: Date = new Date(),
  limit = 20
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(quranReviewCards)
    .where(
      and(
        eq(quranReviewCards.userId, userId),
        lte(quranReviewCards.dueDate, getRiyadhDayKey(now))
      )
    )
    .orderBy(asc(quranReviewCards.dueDate), asc(quranReviewCards.intervalDays))
    .limit(limit);
}
