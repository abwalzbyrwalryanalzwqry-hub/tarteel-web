import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const KEY = "tarteel.serverUrl";

/** العنوان الافتراضي يُضبط وقت البناء (TARTEEL_SERVER_URL) ويمكن تغييره من الإعدادات دون إعادة بناء. */
export const DEFAULT_SERVER_URL: string =
  normalizeServerUrl(String(Constants.expoConfig?.extra?.defaultServerUrl ?? "")) ?? "";

export function normalizeServerUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !/^(localhost|127\.0\.0\.1|10\.|192\.168\.)/.test(url.hostname)) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** يعيد "" إن لم يُضبط أي عنوان بعد (لا افتراضي وقت البناء ولا اختيار من المستخدم). */
export async function getServerUrl(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    return (saved && normalizeServerUrl(saved)) || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

/**
 * عنوان الخادم الذي اختاره المستخدم صراحةً من الإعدادات، أو "" إن لم يختر.
 * دون خادم يعمل التطبيق بنسخة الجهاز المحلية (src/config/localWeb.ts).
 */
export async function getSavedServerUrl(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    return (saved && normalizeServerUrl(saved)) || "";
  } catch {
    return "";
  }
}

export async function setServerUrl(url: string | null) {
  if (url) await SecureStore.setItemAsync(KEY, url);
  else await SecureStore.deleteItemAsync(KEY);
}

/** يتحقق أن العنوان يستجيب كخادم ترتيل (صفحة HTML أو /api/health). */
export async function probeServer(url: string, timeoutMs = 10_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const health = await fetch(`${url}/api/health`, { signal: controller.signal }).catch(() => null);
    if (health?.ok) return true;
    const page = await fetch(url, { signal: controller.signal });
    const html = await page.text();
    return page.ok && html.includes("ترتيل");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
