/**
 * تطبيق ترحيلات قاعدة البيانات في الإنتاج دون drizzle-kit (أداة تطوير لا تُثبَّت في الصورة).
 * يقرأ نفس مجلد drizzle/ وجدول __drizzle_migrations الذي يستخدمه `drizzle-kit migrate`.
 *
 *   node dist/migrate.js            (خدمة migrate في docker-compose)
 *   pnpm db:migrate                 (محلياً)
 */
import "dotenv/config";
import path from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL غير مضبوط");
  process.exit(1);
}

const migrationsFolder = path.resolve(process.env.MIGRATIONS_DIR ?? "drizzle");
const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
try {
  const startedAt = Date.now();
  await migrate(drizzle(connection), { migrationsFolder });
  console.log(`[migrate] اكتملت الترحيلات من ${migrationsFolder} في ${Date.now() - startedAt}ms`);
} catch (error) {
  console.error("[migrate] فشل تطبيق الترحيلات:", error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
