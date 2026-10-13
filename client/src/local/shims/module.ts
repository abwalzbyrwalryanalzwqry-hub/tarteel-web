/** بديل node:module: createRequire يعيد الحزم التي يطلبها كود التصدير (arabic-reshaper فقط). */
// @ts-expect-error الحزمة بلا تعريفات أنواع (تستوردها نسخة الخادم بـ require).
import ArabicReshaper from "arabic-reshaper";

const MODULES: Record<string, unknown> = { "arabic-reshaper": ArabicReshaper };

export function createRequire(_from: string) {
  const req = (id: string) => {
    if (id in MODULES) return MODULES[id];
    throw new Error(`الوحدة ${id} غير متاحة في النسخة المحلية`);
  };
  req.resolve = (id: string) => id;
  return req;
}

export default { createRequire };
