import { type QuranNavigationData, validateQuranNavigationData } from "../../../shared/quranNavigation";

const SCRIPT_ID = "tarteel-quran-navigation";
export const QURAN_NAVIGATION_URL = "/manus-storage/quran-navigation_d0a44e59.js";

declare global {
  interface Window {
    __TARTEEL_QURAN_NAVIGATION__?: QuranNavigationData;
  }
}

let navigationPromise: Promise<QuranNavigationData> | null = null;

export function loadQuranNavigation() {
  if (window.__TARTEEL_QURAN_NAVIGATION__) return Promise.resolve(window.__TARTEEL_QURAN_NAVIGATION__);
  if (navigationPromise) return navigationPromise;
  navigationPromise = new Promise<QuranNavigationData>((resolve, reject) => {
    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const complete = () => {
      const navigation = window.__TARTEEL_QURAN_NAVIGATION__;
      if (!navigation || !validateQuranNavigationData(navigation)) { reject(new Error("تعذر التحقق من بيانات فهرس المصحف.")); return; }
      resolve(navigation);
    };
    if (script) { script.addEventListener("load", complete, { once: true }); script.addEventListener("error", () => reject(new Error("تعذر تحميل بيانات فهرس المصحف.")), { once: true }); return; }
    const next = document.createElement("script");
    next.id = SCRIPT_ID;
    next.src = QURAN_NAVIGATION_URL;
    next.async = true;
    next.onload = complete;
    next.onerror = () => reject(new Error("تعذر تحميل بيانات فهرس المصحف."));
    document.head.appendChild(next);
  });
  return navigationPromise;
}
