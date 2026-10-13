/** تسجيل عامل الخدمة (client/public/sw.js) في نسخة الإنتاج فقط. */
export function setupServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.VITE_DISABLE_SW === "true") {
    // مفتاح إيقاف: يلغي أي عامل سُجّل في نشر سابق ويمسح ذاكرته.
    void navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => void registration.unregister()));
    if ("caches" in window) void caches.keys().then((keys) => keys.filter((key) => key.startsWith("tarteel-")).forEach((key) => void caches.delete(key)));
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => console.warn("[SW] registration failed", error));
  });
}
