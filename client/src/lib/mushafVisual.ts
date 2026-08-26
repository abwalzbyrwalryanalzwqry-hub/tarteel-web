import {
  type MushafVisualRegistry,
  validateMushafRegistry,
} from "../../../shared/mushafVisual";

const REGISTRY_SCRIPT_ID = "tarteel-mushaf-page-registry";
export const MUSHAF_REGISTRY_URL = "/manus-storage/mushaf-page-registry_0f82bc3d.js";

declare global {
  interface Window {
    __TARTEEL_MUSHAF_PAGE_REGISTRY__?: MushafVisualRegistry;
  }
}

let registryPromise: Promise<MushafVisualRegistry> | null = null;

export function loadMushafVisualRegistry() {
  if (window.__TARTEEL_MUSHAF_PAGE_REGISTRY__) {
    return Promise.resolve(window.__TARTEEL_MUSHAF_PAGE_REGISTRY__);
  }
  if (registryPromise) return registryPromise;
  registryPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(REGISTRY_SCRIPT_ID) as HTMLScriptElement | null;
    const finish = () => {
      const registry = window.__TARTEEL_MUSHAF_PAGE_REGISTRY__;
      if (!registry || !validateMushafRegistry(registry)) {
        reject(new Error("تعذر التحقق من فهرس صفحات المصحف."));
        return;
      }
      resolve(registry);
    };
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("تعذر تحميل فهرس صفحات المصحف.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = REGISTRY_SCRIPT_ID;
    script.src = MUSHAF_REGISTRY_URL;
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("تعذر تحميل فهرس صفحات المصحف."));
    document.head.appendChild(script);
  });
  return registryPromise;
}
