/**
 * ما تحتاجه شاشات السجل اليومي والتقارير من «zen-api» في زِن، فوق خادم ترتيل: قائمة الحلقات
 * (daily.halaqat) وأداتا الصورة الرمزية (الحرف الأول ولون ثابت لكل طالب من ألوان ترتيل).
 */
import { mushafApi } from "@/mushaf/compat/api";

export type Halaqa = {
  id: string;
  center_id: string;
  name: string;
  /** المستخدم الحالي إن كان معلم الحلقة أو مساعده، وإلا null. */
  teacher_id: string | null;
  schedule: string | null;
  created_at: string;
};

export const listHalaqat = (): Promise<Halaqa[]> =>
  mushafApi().daily.halaqat.query();

export function initialOf(name: string) {
  return name?.trim()?.[0] ?? "?";
}

/** تدرّجات من ألوان ترتيل (الأخضر والذهبي وما يجاورهما)، ثابتة لكل طالب. */
const palette = [
  "from-emerald-600 to-green-800",
  "from-amber-500 to-yellow-600",
  "from-teal-600 to-emerald-800",
  "from-lime-600 to-green-700",
  "from-yellow-600 to-amber-700",
  "from-green-600 to-teal-700",
];
export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
