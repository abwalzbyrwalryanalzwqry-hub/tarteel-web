/**
 * نسخة ملف من قاعدة بيانات نسخة الجهاز (SQLite) في مجلد التطبيق الخاص.
 * الواجهة تحفظ في IndexedDB أولاً، وترسل نسخة هنا بعد التعديلات؛ تُستعاد إن مُسحت بيانات WebView.
 * الكتابة إلى ملف مؤقت ثم نقله، فلا يبقى ملف نصف مكتوب إن أُغلق التطبيق أثناء الحفظ.
 */
import * as FileSystem from "expo-file-system/legacy";

const DIR = `${FileSystem.documentDirectory ?? ""}tarteel/`;
const FILE = `${DIR}tarteel-local.sqlite`;
const TMP = `${DIR}tarteel-local.sqlite.tmp`;

let chain: Promise<void> = Promise.resolve();

export function saveLocalDatabaseFile(base64: string) {
  chain = chain.then(async () => {
    if (!FileSystem.documentDirectory || !base64) return;
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
    await FileSystem.writeAsStringAsync(TMP, base64, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.deleteAsync(FILE, { idempotent: true });
    await FileSystem.moveAsync({ from: TMP, to: FILE });
  }).catch((error) => console.warn("[Tarteel] local database file save failed", error));
  return chain;
}

export async function readLocalDatabaseFile(): Promise<string | null> {
  await chain;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(FILE, { encoding: FileSystem.EncodingType.Base64 });
  } catch (error) {
    console.warn("[Tarteel] local database file read failed", error);
    return null;
  }
}
