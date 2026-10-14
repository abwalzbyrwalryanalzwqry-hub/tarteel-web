import { LOCAL_WEB_URL } from "../config/localWeb";

/** مفتاح آخر موضع في قارئ المصحف الأصلي السابق (SecureStore)، يُقرأ مرة واحدة للانتقال. */
export const LEGACY_LAST_READ_KEY = "tarteel.quran.lastRead";

export type LegacyLastRead = { surah: number; ayah: number };

export function parseLegacyLastRead(raw: string | null | undefined): LegacyLastRead | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LegacyLastRead> | null;
    const surah = Number(value?.surah);
    const ayah = Number(value?.ayah);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) return null;
    if (!Number.isInteger(ayah) || ayah < 1 || ayah > 286) return null;
    return { surah, ayah };
  } catch {
    return null;
  }
}

/**
 * عنوان تبويب المصحف: نسخة الجهاز المضمّنة بوضع «المصحف المستقل» (?app=reader)، وعلى آخر موضع من
 * القارئ السابق إن وُجد.
 */
export function mushafStartUrl(legacy: LegacyLastRead | null): string {
  if (legacy) return `${LOCAL_WEB_URL}quran/read?surah=${legacy.surah}&ayah=${legacy.ayah}&app=reader`;
  return `${LOCAL_WEB_URL}quran?app=reader`;
}
