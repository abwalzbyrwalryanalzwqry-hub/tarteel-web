import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * نص طبقة البيانات كاملاً لاختبارات فحص المصدر. كانت تقرأ `server/db.ts`
 * وحده، وصار الآن واجهة تعيد التصدير من وحدات `server/data/`؛ فنجمعها هنا
 * بترتيب ثابت حتى تبقى الاختبارات تفحص الكود نفسه.
 */
export function readDataLayerSource(
  root = path.resolve(import.meta.dirname, "../..")
): string {
  const dir = path.join(root, "server/data");
  return readdirSync(dir)
    .filter(file => file.endsWith(".ts"))
    .sort()
    .map(file => readFileSync(path.join(dir, file), "utf8"))
    .join("\n");
}
