/**
 * مشاركة نص (ملخص اليوم في السجل اليومي): مشاركة النظام إن وُجدت — وفي تطبيق أندرويد يحوّلها جسر
 * WebView إلى مربع المشاركة الأصلي — وإلا نسخ النص إلى الحافظة.
 */
export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareText(
  title: string,
  text: string
): Promise<ShareResult> {
  const nav = navigator as Navigator & {
    share?: (d: ShareData) => Promise<void>;
  };
  if (nav.share) {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
