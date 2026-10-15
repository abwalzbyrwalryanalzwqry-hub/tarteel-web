/*
 * يطبّق سمة ترتيل (فاتح/داكن/حسب الجهاز) قبل أول رسم للصفحة، حتى لا تومض الواجهة بالوضع الفاتح
 * عند فتحها في الوضع الليلي. ملف خارجي لأن سياسة CSP تمنع السكربت المضمّن (script-src 'self').
 * المفتاح والقيم نفسها في client/src/contexts/ThemeContext.tsx.
 */
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark =
      stored === "dark" ||
      (stored === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    if (dark) root.classList.add("dark");
    root.style.colorScheme = dark ? "dark" : "light";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#000710" : "#f8f5ee");
  } catch (e) {
    /* تخزين معطّل: تبقى السمة الفاتحة */
  }
})();
