/*
 * عامل خدمة ترتيل: يسرّع الفتح ويعرض الواجهة عند انقطاع الشبكة.
 *
 * - /assets/* (ملفات بأسماء مُجزّأة لا تتغير): من الذاكرة أولاً ثم الشبكة.
 * - صفحات التنقل: الشبكة أولاً حتى تصل أحدث نسخة بعد كل نشر، وعند الانقطاع آخر نسخة محفوظة.
 * - لا نلمس /api/ ولا /storage/ (بيانات المستخدمين ورفوعاتهم الخاصة) ولا أي طلب غير GET
 *   أو من نطاق آخر؛ تمر إلى الشبكة كما هي.
 *
 * لإيقافه في نشر ما: اضبط VITE_DISABLE_SW=true وأعد البناء؛ الواجهة حينها تلغي تسجيله.
 */
const VERSION = "v1";
const ASSETS = `tarteel-assets-${VERSION}`;
const SHELL = `tarteel-shell-${VERSION}`;
const SHELL_KEY = "/__app-shell";
const MAX_ASSETS = 150;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([ASSETS, SHELL]);
    for (const key of await caches.keys()) if (key.startsWith("tarteel-") && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function trimAssets() {
  const cache = await caches.open(ASSETS);
  const keys = await cache.keys();
  for (const request of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(request);
}

async function assetFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) { await cache.put(request, response.clone()); trimAssets(); }
  return response;
}

const OFFLINE_HTML = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ترتيل - لا اتصال</title><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#faf7f0;color:#3b3325;text-align:center"><div><h1 style="font-size:1.4rem">لا يوجد اتصال بالإنترنت</h1><p>تحقق من الاتصال ثم أعد المحاولة.</p><button onclick="location.reload()" style="padding:.6rem 1.4rem;border:0;border-radius:.7rem;background:#b8862f;color:#fff;font-size:1rem">إعادة المحاولة</button></div></body></html>`;

async function navigation(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    // نحفظ نسخة واجهة التطبيق (index.html) فقط، لا صفحات أخطاء.
    if (response.ok && (response.headers.get("content-type") || "").includes("text/html")) await cache.put(SHELL_KEY, response.clone());
    return response;
  } catch {
    return (await cache.match(SHELL_KEY)) || new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/storage/")) return;
  if (request.mode === "navigate") { event.respondWith(navigation(request)); return; }
  if (url.pathname.startsWith("/assets/")) event.respondWith(assetFirst(request));
});
