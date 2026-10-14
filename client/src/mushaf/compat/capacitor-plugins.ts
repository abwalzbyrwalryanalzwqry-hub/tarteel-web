/**
 * بديل إضافات Capacitor (Filesystem وShare وStatusBar وNetwork) في ترتيل. الشيفرة المنقولة من زِن
 * تستوردها ديناميكياً داخل فروع التطبيق الأصلي فقط، وهي مغلقة هنا، فلا تُستدعى فعلياً.
 */
const unavailable = (name: string) =>
  new Proxy(
    {},
    {
      get: () => () => Promise.reject(new Error(`${name} غير متاح في ترتيل`)),
    }
  ) as Record<string, (...args: any[]) => Promise<any>>;

export const Filesystem = unavailable("Filesystem");
export const Share = unavailable("Share");
export const StatusBar = unavailable("StatusBar");
export const Network = unavailable("Network");
export const Directory = {
  Data: "DATA",
  Cache: "CACHE",
  Documents: "DOCUMENTS",
} as const;
