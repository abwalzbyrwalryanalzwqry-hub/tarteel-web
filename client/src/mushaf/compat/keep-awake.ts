/**
 * بديل @capacitor-community/keep-awake في ترتيل: الإضافة نفسها تستعمل في المتصفح Screen Wake Lock API،
 * وهذا تنفيذها على الويب بالواجهة نفسها (isSupported وkeepAwake وallowSleep).
 */
type Sentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
};

let sentinel: Sentinel | null = null;

const wakeLock = () =>
  typeof navigator !== "undefined"
    ? (navigator as WakeLockNavigator).wakeLock
    : undefined;

export const KeepAwake = {
  async isSupported(): Promise<{ isSupported: boolean }> {
    return { isSupported: !!wakeLock() };
  },
  async keepAwake(): Promise<void> {
    const api = wakeLock();
    if (!api || (sentinel && document.visibilityState === "visible")) return;
    sentinel = await api.request("screen");
  },
  async allowSleep(): Promise<void> {
    const current = sentinel;
    sentinel = null;
    await current?.release();
  },
};
