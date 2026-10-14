/**
 * سكربت يُحقن في صفحة ترتيل داخل WebView:
 * - تنزيل ملفات PDF/CSV المولدة كـ blob: (لا يدعمها WebView في أندرويد) وإرسالها للتطبيق لمشاركتها/حفظها.
 * - تأخير URL.revokeObjectURL لأن الصفحة تلغي الرابط مباشرة بعد click().
 * - تحويل window.open (واتساب، روابط خارجية) إلى التطبيق ليفتحها خارجياً.
 * - navigator.share (غير موجود في WebView أندرويد): النص إلى مربع المشاركة الأصلي، والملفات (بطاقة
 *   الآية، التقارير) عبر مسار التنزيل نفسه.
 * - navigator.wakeLock (لا يعمل في WebView أندرويد): «إبقاء الشاشة مضاءة» في القراءة والتلاوة
 *   يطلبه من التطبيق (expo-keep-awake).
 */
export const BRIDGE_SCRIPT = `(function () {
  if (window.__tarteelBridge) return;
  window.__tarteelBridge = true;
  function post(message) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  var revoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) { setTimeout(function () { revoke(u); }, 120000); };
  function sendFile(href, filename) {
    fetch(href).then(function (r) { return r.blob(); }).then(function (blob) {
      var reader = new FileReader();
      reader.onloadend = function () {
        post({ type: "download", filename: filename || "tarteel-file", mime: blob.type || "application/octet-stream", data: String(reader.result).split(",")[1] || "" });
      };
      reader.readAsDataURL(blob);
    }).catch(function (error) { post({ type: "error", message: String(error) }); });
  }
  function isFileHref(h) { return typeof h === "string" && (h.indexOf("blob:") === 0 || h.indexOf("data:") === 0); }
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isFileHref(this.href)) { sendFile(this.href, this.getAttribute("download")); return; }
    return click.apply(this, arguments);
  };
  document.addEventListener("click", function (event) {
    var a = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!a) return;
    if (isFileHref(a.href)) { event.preventDefault(); sendFile(a.href, a.getAttribute("download")); return; }
    if (a.target === "_blank") { event.preventDefault(); post({ type: "open", url: a.href }); }
  }, true);
  window.open = function (u) { if (u) post({ type: "open", url: new URL(String(u), location.href).href }); return null; };
  function define(name, value) { try { Object.defineProperty(navigator, name, { value: value, configurable: true }); } catch (e) {} }
  if (typeof navigator.share !== "function") {
    define("canShare", function (data) {
      return !!data && (typeof data.text === "string" || typeof data.url === "string" || !!(data.files && data.files.length));
    });
    define("share", function (data) {
      data = data || {};
      var file = data.files && data.files[0];
      if (file) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onloadend = function () {
            post({ type: "download", filename: file.name || "tarteel-file", mime: file.type || "application/octet-stream", data: String(reader.result).split(",")[1] || "" });
            resolve();
          };
          reader.onerror = function () { reject(reader.error); };
          reader.readAsDataURL(file);
        });
      }
      var text = [data.text, data.url].filter(Boolean).join("\\n");
      if (!text) return Promise.reject(new TypeError("لا شيء للمشاركة"));
      post({ type: "share", title: data.title || "", text: text });
      return Promise.resolve();
    });
  }
  // دائماً عبر التطبيق: WebView في أندرويد لا يمنح Screen Wake Lock حتى حين تظهر الواجهة.
  (function () {
    var held = 0;
    define("wakeLock", {
      request: function () {
        held += 1;
        post({ type: "keep-awake", on: true });
        var sentinel = {
          type: "screen", released: false, onrelease: null,
          addEventListener: function () {}, removeEventListener: function () {},
          release: function () {
            if (!sentinel.released) {
              sentinel.released = true;
              held = Math.max(0, held - 1);
              if (!held) post({ type: "keep-awake", on: false });
            }
            return Promise.resolve();
          }
        };
        return Promise.resolve(sentinel);
      }
    });
  })();
})(); true;`;

export type BridgeMessage =
  | { type: "download"; filename: string; mime: string; data: string }
  | { type: "open"; url: string }
  | { type: "error"; message: string }
  | { type: "share"; title: string; text: string }
  | { type: "keep-awake"; on: boolean }
  /** نسخة الجهاز: الواجهة تطلب آخر نسخة من ملف قاعدة البيانات، أو ترسل نسخة لحفظها. */
  | { type: "tarteel:db-load"; requestId: string }
  | { type: "tarteel:db-save"; base64: string };
