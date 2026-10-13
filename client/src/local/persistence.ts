/**
 * حفظ قاعدة البيانات المحلية.
 *
 * 1) IndexedDB في WebView (المصدر الأساسي، سريع ومتاح في المتصفح أيضاً للاختبار).
 * 2) نسخة مطابقة في ملف داخل مجلد التطبيق عبر جسر أندرويد (react-native-webview)،
 *    تُستعاد تلقائياً إن مُسحت بيانات WebView وحدها.
 */
const IDB_NAME = "tarteel-local";
const IDB_STORE = "database";
const IDB_KEY = "main";
const NATIVE_MIRROR_DELAY_MS = 2500;

type NativeBridge = { postMessage: (message: string) => void };
type BridgeWindow = Window & {
  ReactNativeWebView?: NativeBridge;
  __tarteelNativeDb?: (payload: {
    requestId: string;
    base64: string | null;
  }) => void;
};

const bridgeWindow = () =>
  typeof window === "undefined" ? undefined : (window as BridgeWindow);
export const hasNativeBridge = () =>
  Boolean(bridgeWindow()?.ReactNativeWebView);

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("تعذر فتح IndexedDB"));
  });
}

async function idbGet(): Promise<Uint8Array | null> {
  const db = await openIdb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(IDB_STORE, "readonly")
        .objectStore(IDB_STORE)
        .get(IDB_KEY);
      request.onsuccess = () => {
        const value = request.result as Uint8Array | ArrayBuffer | undefined;
        resolve(
          value
            ? value instanceof Uint8Array
              ? value
              : new Uint8Array(value)
            : null
        );
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function idbPut(bytes: Uint8Array, key = IDB_KEY) {
  const db = await openIdb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(bytes, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** يطلب من التطبيق الأصلي آخر نسخة محفوظة في الملف (null إن لم توجد أو لم يرد خلال المهلة). */
function requestNativeCopy(timeoutMs = 4000): Promise<Uint8Array | null> {
  const win = bridgeWindow();
  if (!win?.ReactNativeWebView) return Promise.resolve(null);
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    win.__tarteelNativeDb = payload => {
      if (payload.requestId !== requestId) return;
      clearTimeout(timer);
      try {
        resolve(payload.base64 ? base64ToBytes(payload.base64) : null);
      } catch {
        resolve(null);
      }
    };
    win.ReactNativeWebView!.postMessage(
      JSON.stringify({ type: "tarteel:db-load", requestId })
    );
  });
}

export async function loadPersistedDatabase(): Promise<Uint8Array | null> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // اختياري: يقلل احتمال حذف المتصفح للبيانات عند امتلاء التخزين.
  }
  let fromIdb: Uint8Array | null = null;
  try {
    fromIdb = await idbGet();
  } catch (error) {
    console.warn("[Local DB] IndexedDB read failed", error);
  }
  if (fromIdb?.length) return fromIdb;
  const fromNative = await requestNativeCopy();
  if (fromNative?.length) {
    await idbPut(fromNative).catch(() => undefined);
    return fromNative;
  }
  return null;
}

let pending: Uint8Array | null = null;
let writing: Promise<void> = Promise.resolve();
let nativeTimer: ReturnType<typeof setTimeout> | undefined;
let latest: Uint8Array | null = null;

function mirrorToNative(bytes: Uint8Array) {
  const win = bridgeWindow();
  if (!win?.ReactNativeWebView) return;
  win.ReactNativeWebView.postMessage(
    JSON.stringify({ type: "tarteel:db-save", base64: bytesToBase64(bytes) })
  );
}

/** يحفظ نسخة؛ الكتابات المتتالية تُدمج فلا يُكتب إلا آخرها. */
export function persistDatabase(bytes: Uint8Array) {
  latest = bytes;
  pending = bytes;
  writing = writing.then(async () => {
    const next = pending;
    pending = null;
    if (!next) return;
    try {
      await idbPut(next);
    } catch (error) {
      console.error("[Local DB] IndexedDB write failed", error);
    }
  });
  clearTimeout(nativeTimer);
  nativeTimer = setTimeout(
    () => latest && mirrorToNative(latest),
    NATIVE_MIRROR_DELAY_MS
  );
}

/** نسخة أمان من البيانات الحالية قبل استعادة نسخة احتياطية (تبقى في IndexedDB). */
export function keepPreRestoreCopy(bytes: Uint8Array) {
  return idbPut(bytes, "before-restore");
}

/** يستبدل البيانات المحفوظة كلها (IndexedDB ونسخة التطبيق) ثم ينتظر اكتمال الكتابة. */
export async function replacePersistedDatabase(bytes: Uint8Array) {
  await writing;
  pending = null;
  latest = bytes;
  await idbPut(bytes);
  clearTimeout(nativeTimer);
  mirrorToNative(bytes);
}

export async function flushPersistence() {
  clearTimeout(nativeTimer);
  if (latest) mirrorToNative(latest);
  await writing;
}

if (typeof window !== "undefined") {
  const flush = () => void flushPersistence();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
