/**
 * بديل @capacitor/core في ترتيل: ترتيل يعمل في المتصفح وداخل WebView تطبيق أندرويد دون Capacitor،
 * فكل فروع «التطبيق الأصلي» في شيفرة زِن تُغلق ويعمل فرع الويب (تشغيل التلاوة والمشاركة والملء الكامل).
 */
export type PluginListenerHandle = { remove: () => Promise<void> };

export const Capacitor = {
  isNativePlatform: (): boolean => false,
  isPluginAvailable: (_name: string): boolean => false,
  getPlatform: (): "web" => "web",
  convertFileSrc: (url: string): string => url,
};

/** إضافة أصلية غير متاحة: أي نداء يُرفض، والشيفرة المنقولة لا تبلغه لأن isNativePlatform() خطأ. */
export function registerPlugin<T>(name: string): T {
  return new Proxy(
    {},
    {
      get: () => () => Promise.reject(new Error(`${name} غير متاح في ترتيل`)),
    }
  ) as T;
}
