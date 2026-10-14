/**
 * داخل تطبيق ترتيل لأندرويد (WebView): الصفحة تراسل التطبيق عبر ReactNativeWebView.postMessage
 * (mobile-android/src/web/bridge.ts). الطباعة ونوافذ window.open لا تعمل في WebView، فيُطلب ملف PDF من
 * التطبيق مباشرة (expo-print) ثم تُفتح ورقة المشاركة.
 */
type NativeWindow = Window & {
  ReactNativeWebView?: { postMessage: (data: string) => void };
};

export function isTarteelApp(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as NativeWindow).ReactNativeWebView?.postMessage ===
      "function"
  );
}

/** يطلب من التطبيق تحويل صفحة HTML كاملة إلى ملف PDF ومشاركته. */
export function requestAppPdf(
  html: string,
  filename: string,
  landscape = false
): boolean {
  if (!isTarteelApp()) return false;
  (window as NativeWindow).ReactNativeWebView!.postMessage(
    JSON.stringify({
      type: "pdf",
      html,
      filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
      landscape,
    })
  );
  return true;
}
