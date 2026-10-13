/**
 * نسخة الجهاز (تطبيق أندرويد دون خادم) تُبنى بـ `vite build --mode device`.
 * __TARTEEL_DEVICE__ يُستبدل بـ true/false وقت البناء (vite.config.ts)؛ استعمله مباشرة في الشروط
 * ليحذف المجمّع شيفرة نسخة الجهاز من نسخة الخادم.
 */
declare global {
  const __TARTEEL_DEVICE__: boolean;
}

export const IS_DEVICE_EDITION = __TARTEEL_DEVICE__;
