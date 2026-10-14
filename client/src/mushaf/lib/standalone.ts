/**
 * «المصحف المستقل»: قسم المصحف وحده دون حساب ودون قاعدة بيانات، لتبويب «المصحف» في تطبيق أندرويد.
 *
 * التبويب يفتح نسخة الجهاز المضمّنة في التطبيق على `/quran?app=reader`، في WebView مستقل عن تبويب
 * «المنصة». لو شغّل هذا التبويب منطق الخادم المحلي (sql.js) لصار على الجهاز نسختان من قاعدة البيانات
 * تحفظ كل منهما فوق الأخرى، فيضيع ما سُجّل في المنصة. لذلك يعمل هنا بلا tRPC ولا حساب (وضع الضيف في
 * زِن): القراءة والتفسير والبحث والعلامات والختمة والتلاوات محفوظة على الجهاز (localStorage)، وهي
 * التخزين نفسه الذي يقرؤه المصحف داخل المنصة لأن الأصل واحد، فتظهر العلامات في الموضعين.
 *
 * الوضع مقصور على نسخة الجهاز، ويبقى طوال جلسة الصفحة (sessionStorage) لأن التنقل داخل القسم يُسقط
 * المعامل من العنوان.
 */
export const STANDALONE_PARAM = "app";
export const STANDALONE_VALUE = "reader";
const KEY = "tarteel.mushaf.standalone";

export function detectStandaloneMushaf(
  device: boolean,
  location: { pathname: string; search: string },
  storage: Pick<Storage, "getItem" | "setItem"> | null
): boolean {
  if (!device) return false;
  const requested =
    new URLSearchParams(location.search).get(STANDALONE_PARAM) ===
    STANDALONE_VALUE;
  try {
    if (requested) storage?.setItem(KEY, "1");
    return requested || storage?.getItem(KEY) === "1";
  } catch {
    return requested;
  }
}

function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  return detectStandaloneMushaf(__TARTEEL_DEVICE__, window.location, storage);
}

/** ثابت طوال عمر الصفحة: يُحسب مرة واحدة عند التحميل. */
export const STANDALONE_MUSHAF = readStandalone();
