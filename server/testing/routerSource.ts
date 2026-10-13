import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * نص كل موجّهات tRPC مجتمعة: server/routers.ts وملفات server/routers/ (عدا الاختبارات).
 * بعض الاختبارات تتحقق من وجود قيود معينة في نص الموجّه؛ بعد تقسيمه حسب المجال تبحث هنا.
 */
export function readRouterSource(root = process.cwd()) {
  const dir = path.join(root, "server/routers");
  const parts = readdirSync(dir)
    .filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .sort()
    .map(file => readFileSync(path.join(dir, file), "utf8"));
  return [
    readFileSync(path.join(root, "server/routers.ts"), "utf8"),
    ...parts,
  ].join("\n");
}
