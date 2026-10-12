/**
 * سكربت يُحقن في صفحة ترتيل داخل WebView:
 * - تنزيل ملفات PDF/CSV المولدة كـ blob: (لا يدعمها WebView في أندرويد) وإرسالها للتطبيق لمشاركتها/حفظها.
 * - تأخير URL.revokeObjectURL لأن الصفحة تلغي الرابط مباشرة بعد click().
 * - تحويل window.open (واتساب، روابط خارجية) إلى التطبيق ليفتحها خارجياً.
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
})(); true;`;

export type BridgeMessage =
  | { type: "download"; filename: string; mime: string; data: string }
  | { type: "open"; url: string }
  | { type: "error"; message: string };
