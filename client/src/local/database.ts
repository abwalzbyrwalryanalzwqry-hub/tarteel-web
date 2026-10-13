/**
 * قاعدة بيانات ترتيل المحلية: SQLite (sql.js/WASM) داخل التطبيق بدل خادم MySQL.
 *
 * - منطق الخادم نفسه (server/data/*) يعمل عليها عبر drizzle sqlite-proxy، وهو مشغّل غير متزامن
 *   يدعم المعاملات التي تحتوي await (مشغّل sql-js المتزامن في drizzle لا يدعمها).
 * - نتيجة جمل الكتابة تُعاد بصيغة MySQL ([{ insertId, affectedRows }]) فيعمل الكود القائم دون تعديل.
 * - onDuplicateKeyUpdate (MySQL) يُترجم إلى ON CONFLICT DO UPDATE دون هدف، وهو يطابق أي قيد فريد كما في MySQL.
 * - الحفظ: IndexedDB بعد كل كتابة (مع تأخير قصير)، ونسخة احتياطية في ملف أصلي عبر جسر أندرويد.
 */
import initSqlJs, {
  type Database,
  type SqlJsStatic,
  type SqlValue,
} from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { sql } from "drizzle-orm";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { SQLiteInsertBase } from "drizzle-orm/sqlite-core";
// mapUpdateSet موجودة في drizzle-orm/utils.js لكن غير معلنة في أنواعه.
import * as drizzleUtils from "drizzle-orm/utils";
const mapUpdateSet = (
  drizzleUtils as unknown as {
    mapUpdateSet: (table: never, set: never) => unknown;
  }
).mapUpdateSet;
import * as schema from "../../../drizzle/schema.sqlite";
import {
  loadPersistedDatabase,
  persistDatabase,
  flushPersistence,
  keepPreRestoreCopy,
  replacePersistedDatabase,
} from "./persistence";

const migrationFiles = import.meta.glob("../../../drizzle-sqlite/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type LocalDb = SqliteRemoteDatabase<typeof schema>;

let sqlite: Database | null = null;
let localDb: LocalDb | null = null;
let initPromise: Promise<LocalDb> | null = null;
let inTransactionDepth = 0;
/** بعد استعادة نسخة احتياطية: لا يُحفظ شيء من القاعدة القديمة حتى إعادة تحميل الصفحة. */
let replaced = false;
let sqlModule: Promise<SqlJsStatic> | null = null;
const getSql = () => (sqlModule ??= initSqlJs({ locateFile: () => wasmUrl }));

/** sql.js لا يقبل Date ولا boolean؛ نحولهما كما يخزنهما مخطط SQLite (ملي ثانية و0/1). */
function normalizeParam(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return JSON.stringify(value);
}

function selectRows(db: Database, text: string, params: SqlValue[]) {
  const stmt = db.prepare(text);
  try {
    stmt.bind(params);
    const rows: SqlValue[][] = [];
    while (stmt.step()) rows.push(stmt.get());
    return rows;
  } finally {
    stmt.free();
  }
}

let patched = false;
/** يضيف onDuplicateKeyUpdate (واجهة MySQL في drizzle) إلى جمل الإدراج في SQLite. */
function patchMysqlUpsert() {
  if (patched) return;
  patched = true;
  type InsertInternals = {
    config: { table: never; onConflict?: unknown[] };
    dialect: { buildUpdateSet: (table: never, set: unknown) => unknown };
  };
  const proto = SQLiteInsertBase.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.onDuplicateKeyUpdate = function onDuplicateKeyUpdate(
    this: InsertInternals,
    config: { set: Record<string, unknown> }
  ) {
    const setSql = this.dialect.buildUpdateSet(
      this.config.table,
      mapUpdateSet(this.config.table, config.set as never)
    );
    if (!this.config.onConflict) this.config.onConflict = [];
    this.config.onConflict.push(sql` on conflict do update set ${setSql}`);
    return this;
  };
}

function applyMigrations(db: Database) {
  db.run(
    "CREATE TABLE IF NOT EXISTS __tarteel_migrations (name TEXT PRIMARY KEY NOT NULL, appliedAt INTEGER NOT NULL)"
  );
  db.run(
    "CREATE TABLE IF NOT EXISTS __tarteel_files (fileKey TEXT PRIMARY KEY NOT NULL, contentType TEXT NOT NULL, data BLOB NOT NULL, createdAt INTEGER NOT NULL)"
  );
  const applied = new Set(
    selectRows(db, "SELECT name FROM __tarteel_migrations", []).map(row =>
      String(row[0])
    )
  );
  const names = Object.keys(migrationFiles).sort();
  let changed = false;
  for (const path of names) {
    const name = path
      .split("/")
      .pop()!
      .replace(/\.sql$/, "");
    if (applied.has(name)) continue;
    const statements = migrationFiles[path]
      .split("--> statement-breakpoint")
      .map(part => part.trim())
      .filter(Boolean);
    db.run("BEGIN");
    try {
      for (const statement of statements) db.run(statement);
      db.run(
        "INSERT INTO __tarteel_migrations (name, appliedAt) VALUES (?, ?)",
        [name, Date.now()]
      );
      db.run("COMMIT");
      changed = true;
    } catch (error) {
      db.run("ROLLBACK");
      throw new Error(
        `تعذر تحديث قاعدة البيانات المحلية (${name}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return changed;
}

async function open(): Promise<LocalDb> {
  patchMysqlUpsert();
  const SQL = await getSql();
  const saved = await loadPersistedDatabase();
  sqlite = saved ? new SQL.Database(saved) : new SQL.Database();
  sqlite.run("PRAGMA foreign_keys = OFF");
  const migrated = applyMigrations(sqlite);
  if (migrated || !saved) persistDatabase(exportSnapshot(sqlite));

  const db = sqlite;
  localDb = drizzle(
    async (text, params, method) => {
      const values = params.map(normalizeParam);
      if (method === "run") {
        if (/^\s*begin\b/i.test(text)) inTransactionDepth += 1;
        if (
          /^\s*(commit|rollback)\b/i.test(text) &&
          !/^\s*rollback\s+to\b/i.test(text)
        )
          inTransactionDepth = Math.max(0, inTransactionDepth - 1);
        db.run(text, values);
        const affectedRows = db.getRowsModified();
        const insertId = Number(
          selectRows(db, "SELECT last_insert_rowid()", [])[0]?.[0] ?? 0
        );
        // لا نحفظ داخل معاملة مفتوحة: الحفظ بعد COMMIT يكفي ويمنع حفظ نصف معاملة.
        if (affectedRows > 0 || /^\s*(commit|create|drop|alter)/i.test(text))
          scheduleSave();
        // صيغة نتيجة mysql2 ([ResultSetHeader]) التي يقرؤها كود الخادم.
        return Object.assign([{ insertId, affectedRows }], {
          rows: [] as unknown[],
        }) as unknown as { rows: unknown[] };
      }
      const rows = selectRows(db, text, values);
      if (method === "get")
        return { rows: (rows[0] ?? undefined) as unknown as unknown[] };
      return { rows };
    },
    { schema }
  );
  return localDb;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave() {
  if (!sqlite || replaced) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!sqlite || replaced) return;
    // export() في sql.js يغلق القاعدة ويعيد فتحها، فلا نصدّر أثناء معاملة مفتوحة؛ نعيد المحاولة بعدها.
    if (inTransactionDepth > 0) return scheduleSave();
    persistDatabase(exportSnapshot(sqlite));
  }, 350);
}

export function initLocalDatabase() {
  initPromise ??= open();
  return initPromise;
}

export async function getLocalDb() {
  return initLocalDatabase();
}

/** حفظ فوري (عند إغلاق التطبيق أو قبل تصدير نسخة احتياطية). */
export async function saveLocalDatabaseNow() {
  if (!sqlite || replaced) return;
  clearTimeout(saveTimer);
  if (inTransactionDepth === 0) persistDatabase(exportSnapshot(sqlite));
  await flushPersistence();
}

/** محتوى قاعدة البيانات كاملاً (للنسخ الاحتياطي). */
export function exportLocalDatabase(): Uint8Array {
  if (!sqlite) throw new Error("قاعدة البيانات المحلية غير جاهزة");
  return exportSnapshot(sqlite);
}

const SQLITE_HEADER = "SQLite format 3\u0000";
const REQUIRED_TABLES = ["users", "centers", "__tarteel_migrations"];

export interface LocalBackupInfo {
  users: number;
  centers: number;
  students: number;
  circles: number;
}

const knownMigrations = () =>
  new Set(
    Object.keys(migrationFiles).map(path =>
      path
        .split("/")
        .pop()!
        .replace(/\.sql$/, "")
    )
  );

/** يتحقق أن الملف نسخة احتياطية من ترتيل يمكن فتحها في هذا الإصدار، ويعيد ملخص محتواها. */
export async function inspectLocalBackup(
  bytes: Uint8Array
): Promise<LocalBackupInfo> {
  const header = new TextDecoder("latin1").decode(bytes.subarray(0, 16));
  if (bytes.length < 512 || header !== SQLITE_HEADER)
    throw new Error("هذا الملف ليس نسخة احتياطية من ترتيل");
  const SQL = await getSql();
  let db: Database;
  try {
    db = new SQL.Database(bytes);
  } catch {
    throw new Error("الملف تالف أو غير مكتمل؛ تعذر فتحه");
  }
  try {
    const tables = new Set(
      selectRows(db, "SELECT name FROM sqlite_master WHERE type = 'table'", []).map(
        row => String(row[0])
      )
    );
    if (REQUIRED_TABLES.some(name => !tables.has(name)))
      throw new Error("هذا الملف ليس نسخة احتياطية من ترتيل");
    const integrity = String(selectRows(db, "PRAGMA quick_check", [])[0]?.[0] ?? "");
    if (integrity !== "ok") throw new Error("الملف تالف؛ فشل فحص سلامة البيانات");
    const known = knownMigrations();
    const newer = selectRows(db, "SELECT name FROM __tarteel_migrations", [])
      .map(row => String(row[0]))
      .filter(name => !known.has(name));
    if (newer.length)
      throw new Error(
        "هذه النسخة من إصدار أحدث من التطبيق؛ حدّث ترتيل ثم أعد المحاولة"
      );
    const count = (table: string) =>
      tables.has(table)
        ? Number(selectRows(db, `SELECT count(*) FROM "${table}"`, [])[0]?.[0] ?? 0)
        : 0;
    return {
      users: count("users"),
      centers: count("centers"),
      students: count("students"),
      circles: count("circles"),
    };
  } finally {
    db.close();
  }
}

/**
 * يستبدل قاعدة الجهاز كلها بنسخة احتياطية. تُحفظ البيانات الحالية أولاً كنسخة أمان،
 * ويلزم إعادة تحميل الصفحة بعدها (تُطبَّق الترحيلات على النسخة إن كانت أقدم).
 */
export async function replaceLocalDatabase(bytes: Uint8Array) {
  await inspectLocalBackup(bytes);
  await initLocalDatabase();
  if (sqlite && inTransactionDepth === 0)
    await keepPreRestoreCopy(exportSnapshot(sqlite)).catch(() => undefined);
  replaced = true;
  clearTimeout(saveTimer);
  await replacePersistedDatabase(bytes);
}

/** وصول مباشر لجمل SQL بسيطة (ملفات الشعارات، الصيانة). */
export function rawLocalQuery(text: string, params: unknown[] = []) {
  if (!sqlite) throw new Error("قاعدة البيانات المحلية غير جاهزة");
  return selectRows(sqlite, text, params.map(normalizeParam));
}

export function rawLocalRun(text: string, params: unknown[] = []) {
  if (!sqlite) throw new Error("قاعدة البيانات المحلية غير جاهزة");
  sqlite.run(text, params.map(normalizeParam));
  scheduleSave();
}

/** export() يعيد ضبط PRAGMA إلى الافتراضي؛ نعيد ما نحتاجه بعده. */
function exportSnapshot(db: Database) {
  const bytes = db.export();
  db.run("PRAGMA foreign_keys = OFF");
  return bytes;
}
