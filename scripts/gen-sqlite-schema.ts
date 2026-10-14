#!/usr/bin/env tsx
/**
 * يولّد drizzle/schema.sqlite.ts من drizzle/schema.ts (MySQL) لنسخة ترتيل المحلية على أندرويد.
 *
 * النسخة المحلية تشغّل منطق الخادم نفسه داخل التطبيق على SQLite. أسماء الجداول والأعمدة
 * والفهارس تبقى كما هي، وتتغير الأنواع فقط:
 *   int/tinyint → integer، varchar/text/mediumtext/mysqlEnum → text، boolean → integer(boolean)،
 *   timestamp → integer(timestamp_ms)، decimal → numeric (نص كما في MySQL).
 *
 * الاستخدام: tsx scripts/gen-sqlite-schema.ts [--check]
 * --check يفشل إن كان الملف المولّد قديماً (يستخدمه الاختبار وCI).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "drizzle/schema.ts");
const targetPath = resolve(root, "drizzle/schema.sqlite.ts");

export function convertSchema(source: string): string {
  let out = source;

  // الاستيراد
  out = out.replace(
    /import\s*\{[^}]*\}\s*from\s*"drizzle-orm\/mysql-core";/,
    'import { index, integer, numeric, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";'
  );
  out = out.replace(/\bmysqlTable\(/g, "sqliteTable(");

  // المفتاح الأساسي التلقائي
  out = out.replace(
    /\bint\(("[^"]+")\)\.autoincrement\(\)\.primaryKey\(\)/g,
    "integer($1).primaryKey({ autoIncrement: true })"
  );
  if (/\.autoincrement\(\)/.test(out))
    throw new Error("autoincrement() بصيغة غير مدعومة في المحوّل");

  // الأنواع
  out = out.replace(
    /\bmysqlEnum\(("[^"]+"),\s*(\[[^\]]*\])\)/g,
    "text($1, { enum: $2 })"
  );
  out = out.replace(
    /\bboolean\(("[^"]+")\)/g,
    'integer($1, { mode: "boolean" })'
  );
  out = out.replace(
    /\btimestamp\(("[^"]+")\)/g,
    'integer($1, { mode: "timestamp_ms" })'
  );
  out = out.replace(/\bmediumtext\(("[^"]+")\)/g, "text($1)");
  out = out.replace(/\bdecimal\(("[^"]+")(?:,\s*\{[^}]*\})?\)/g, "numeric($1)");
  out = out.replace(
    /\b(?:int|tinyint)\(("[^"]+")(?:,\s*\{[^}]*\})?\)/g,
    "integer($1)"
  );
  out = out.replace(
    /\bvarchar\(("[^"]+"),\s*\{\s*length:\s*\d+\s*(?:,\s*(enum:\s*\[[^\]]*\]))?\s*\}\)/g,
    (_m: string, name: string, enumPart?: string) =>
      enumPart ? `text(${name}, { ${enumPart} })` : `text(${name})`
  );
  if (/\bvarchar\(/.test(out))
    throw new Error("varchar() بصيغة غير مدعومة في المحوّل");

  // القيم الافتراضية للوقت: SQLite لا يملك defaultNow/onUpdateNow لأعمدة timestamp_ms؛ نولّدها في التطبيق.
  out = out.replace(/\.defaultNow\(\)/g, ".$defaultFn(() => new Date())");
  out = out.replace(/\.onUpdateNow\(\)/g, ".$onUpdate(() => new Date())");

  for (const leftover of [
    "mysql",
    "int(",
    "tinyint(",
    "decimal(",
    "timestamp(",
  ]) {
    const re =
      leftover === "mysql"
        ? /mysql/i
        : new RegExp(`\\b${leftover.replace("(", "\\(")}`);
    const match = out.match(re);
    if (match) throw new Error(`بقي نوع غير محوّل في المخطط: ${match[0]}`);
  }

  const header = [
    "// ⚠️ ملف مولّد آلياً من drizzle/schema.ts بواسطة scripts/gen-sqlite-schema.ts — لا تعدّله يدوياً.",
    "// يُستخدم في نسخة ترتيل المحلية (SQLite داخل التطبيق). بعد تعديل schema.ts شغّل: pnpm db:sqlite",
    "",
  ].join("\n");
  return header + out;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // يُنسَّق الناتج بـ Prettier ليطابق فحص التنسيق في CI.
  const generated = await format(
    convertSchema(readFileSync(sourcePath, "utf8")),
    {
      ...(await resolveConfig(targetPath)),
      filepath: targetPath,
    }
  );
  if (process.argv.includes("--check")) {
    const current = readFileSync(targetPath, "utf8");
    if (current !== generated) {
      console.error("drizzle/schema.sqlite.ts قديم؛ شغّل pnpm db:sqlite");
      process.exit(1);
    }
    console.log("drizzle/schema.sqlite.ts محدّث");
  } else {
    writeFileSync(targetPath, generated);
    console.log("كُتب drizzle/schema.sqlite.ts");
  }
}
