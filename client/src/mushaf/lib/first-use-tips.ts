/**
 * تلميحات الاستعمال الأول (1.19.0، المرحلة 3): سطر واحد يشرح إيماءة لا تُكتشف وحدها (سحب بطاقة الطالب، وشبكة
 * الآيات، ومصمّم الشهادة). يظهر حتى يُغلقه المستخدم ثم لا يعود.
 *
 * لكل حساب على الجهاز: المفتاح `tarteel-tips-seen:<userId>`، فحسابان على جهاز واحد لكلٍّ تلميحاته.
 */
import { useState } from "react";
import { useSession } from "@/mushaf/hooks/useSession";

export type TipId = "swipe" | "ayahGrid" | "designer";
export const TIPS_KEY = "tarteel-tips-seen";
export const tipsKey = (userId?: string | null) =>
  userId ? `${TIPS_KEY}:${userId}` : TIPS_KEY;

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function seenTips(
  userId?: string | null,
  remote?: unknown
): Set<string> {
  let local: string[] = [];
  try {
    local = asList(JSON.parse(localStorage.getItem(tipsKey(userId)) ?? "[]"));
  } catch {
    /* تالف أو غير متاح */
  }
  return new Set([...local, ...asList(remote)]);
}

export function markTipSeen(
  id: TipId,
  userId?: string | null,
  remote?: unknown
): Set<string> {
  const s = seenTips(userId, remote);
  s.add(id);
  try {
    localStorage.setItem(tipsKey(userId), JSON.stringify([...s]));
  } catch {
    /* التخزين غير متاح */
  }
  return s;
}

/** [ظاهر؟، إغلاق]. */
export function useFirstUseTip(id: TipId): [boolean, () => void] {
  const { userId: account, guest } = useSession();
  const userId = guest ? null : account;
  const remote: unknown = undefined;
  const [dismissed, setDismissed] = useState(false);
  const show = !dismissed && !seenTips(userId, remote).has(id);
  return [
    show,
    () => {
      markTipSeen(id, userId, remote);
      setDismissed(true);
    },
  ];
}
