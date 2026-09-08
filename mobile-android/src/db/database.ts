import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "tarteel-local.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

const schemaStatements = [
  `PRAGMA foreign_keys = ON;`,
  `CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS centers (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT, name TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS circles (id TEXT PRIMARY KEY NOT NULL, center_id TEXT NOT NULL, name TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS teachers (id TEXT PRIMARY KEY NOT NULL, center_id TEXT NOT NULL, name TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY NOT NULL, center_id TEXT NOT NULL, circle_id TEXT, name TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, circle_id TEXT NOT NULL, session_date TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, student_id TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS memorization (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, student_id TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS revision (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, student_id TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS evaluation (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, student_id TEXT NOT NULL, payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS quran_bookmarks (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, reference_key TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS sync_outbox (operation_id TEXT PRIMARY KEY NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, operation_type TEXT NOT NULL CHECK (operation_type IN ('CREATE','UPDATE','DELETE')), payload_json TEXT NOT NULL, user_id TEXT NOT NULL, device_id TEXT NOT NULL, base_version INTEGER, created_at TEXT NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK (status IN ('PENDING','SYNCING','SYNCED','FAILED','CONFLICT')), last_error TEXT, next_attempt_at TEXT);`,
  `CREATE TABLE IF NOT EXISTS sync_conflicts (conflict_id TEXT PRIMARY KEY NOT NULL, operation_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, local_json TEXT NOT NULL, remote_json TEXT NOT NULL, detected_at TEXT NOT NULL, resolution TEXT NOT NULL DEFAULT 'PENDING', resolved_at TEXT);`,
  `CREATE INDEX IF NOT EXISTS students_circle_idx ON students(circle_id, deleted_at);`,
  `CREATE INDEX IF NOT EXISTS sessions_circle_date_idx ON sessions(circle_id, session_date, deleted_at);`,
  `CREATE INDEX IF NOT EXISTS attendance_session_student_idx ON attendance(session_id, student_id, deleted_at);`,
  `CREATE INDEX IF NOT EXISTS outbox_status_idx ON sync_outbox(status, next_attempt_at, created_at);`,
];

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= initializeDatabase();
  return databasePromise;
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(schemaStatements.join("\n"));
  return db;
}

export async function withTransaction<T>(work: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = await getDatabase();
  await db.execAsync("BEGIN IMMEDIATE;");
  try {
    const result = await work(db);
    await db.execAsync("COMMIT;");
    return result;
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}
