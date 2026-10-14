import { mushafApi } from "@/mushaf/compat/api";
import { SURAHS } from "@/mushaf/lib/quran-meta";
import {
  isNetworkError,
  queueReview,
  startReviewOutbox,
  type ReviewOutboxItem,
} from "@/mushaf/lib/quran/review-outbox";

/** نتيجة «أتقنتُها»: كرت المراجعة من الخادم، أو `queued` إن حُفظ للإرسال لاحقاً (M8). */
export type MasteredResult =
  { due_date?: string; queued?: false } | { queued: true } | null;

/**
 * في ترتيل: كرت المراجعة المتباعدة لصاحب الحساب نفسه (quranReview.markMastered)، والخادم يعرّف
 * الحساب من الجلسة؛ اسم السورة في عنصر الصندوق يُحوَّل إلى رقمها كما في زِن.
 */
async function sendReview(i: ReviewOutboxItem) {
  const surahNumber = SURAHS.find(s => s.name === i.surah_name)?.n;
  if (!surahNumber) throw new Error("سورة غير معروفة.");
  return mushafApi().quranReview.markMastered.mutate({
    surahNumber,
    fromAyah: i.from_ayah,
    toAyah: i.to_ayah,
  });
}

/** يُستدعى مرة عند فتح المصحف: يرسل المراجعات المحفوظة الآن وكلما عاد الاتصال. */
export const startSelfReviewSync = () => startReviewOutbox(sendReview);

/**
 * «أتقنتُها» (8.1): مراجعة ذاتية بدرجة 95، فيُنشأ أو يُحدَّث كرت المراجعة المتباعدة للمقطع.
 */
export async function markMastered(
  userId: string,
  surah: number,
  from: number,
  to: number,
  /** اسم الكرت كما هو مخزَّن (من طابور اليوم)، حتى لا يُنشأ كرت مكرّر بهمزة مختلفة. */
  surahName?: string
): Promise<MasteredResult> {
  const name = surahName ?? SURAHS.find(s => s.n === surah)?.name;
  if (!name) throw new Error("سورة غير معروفة.");
  const item: ReviewOutboxItem = {
    student_id: userId,
    surah_name: name,
    from_ayah: from,
    to_ayah: to,
    score: 95,
    queued_at: new Date().toISOString(),
  };
  try {
    return (await sendReview(item)) as MasteredResult;
  } catch (e) {
    // بلا اتصال: يُحفظ على الجهاز ويُرسل عند عودته، فلا يضيع جهد الطالب.
    if (!isNetworkError(e)) throw e;
    queueReview(item);
    return { queued: true };
  }
}
