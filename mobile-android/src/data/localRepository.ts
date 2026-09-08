import { getDatabase, withTransaction } from "../db/database";
import { enqueueOperation, type OutboxOperationType } from "../sync/outbox";

const tableByEntity = {
  center: "centers",
  circle: "circles",
  teacher: "teachers",
  student: "students",
  session: "sessions",
  attendance: "attendance",
  memorization: "memorization",
  revision: "revision",
  evaluation: "evaluation",
  bookmark: "quran_bookmarks",
} as const;

export type LocalEntity = keyof typeof tableByEntity;

export type LocalEntityRecord = {
  id: string;
  name?: string;
  payload: Record<string, unknown>;
  version?: number;
  updatedAt?: string;
  deletedAt?: string | null;
};

function assertSafeIdentifier(identifier: string): void {
  if (!/^[a-z_]+$/.test(identifier)) throw new Error("معرف جدول غير مسموح");
}

export async function upsertLocalEntity(
  entity: LocalEntity,
  record: LocalEntityRecord,
  actor: { userId: string; deviceId: string },
  operationType: OutboxOperationType = "UPDATE",
): Promise<void> {
  const table = tableByEntity[entity];
  assertSafeIdentifier(table);
  const now = record.updatedAt ?? new Date().toISOString();
  const name = record.name ?? String(record.payload.name ?? record.id);
  const version = record.version ?? 0;
  const hasNameColumn = ["centers", "circles", "teachers", "students", "sessions"].includes(table);

  await withTransaction(async (db) => {
    if (hasNameColumn) {
      await db.runAsync(
        `INSERT INTO ${table} (id, name, payload_json, version, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload_json = excluded.payload_json,
         version = excluded.version, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
        record.id,
        name,
        JSON.stringify(record.payload),
        version,
        now,
        record.deletedAt ?? null,
      );
    } else {
      await db.runAsync(
        `INSERT INTO ${table} (id, payload_json, updated_at, deleted_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json,
         updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
        record.id,
        JSON.stringify(record.payload),
        now,
        record.deletedAt ?? null,
      );
    }

    await enqueueOperation({
      entity,
      entityId: record.id,
      operationType,
      payloadJson: JSON.stringify({ ...record.payload, id: record.id, version }),
      userId: actor.userId,
      deviceId: actor.deviceId,
      baseVersion: version,
    });
  });
}

export async function getLocalEntity(entity: LocalEntity, id: string): Promise<LocalEntityRecord | null> {
  const records = await listLocalEntities(entity, 1000);
  return records.find((record) => record.id === id) ?? null;
}

export async function deleteLocalEntity(
  entity: LocalEntity,
  id: string,
  actor: { userId: string; deviceId: string },
): Promise<void> {
  const existing = await getLocalEntity(entity, id);
  if (!existing) return;
  await upsertLocalEntity(entity, { ...existing, deletedAt: new Date().toISOString() }, actor, "DELETE");
}

export async function countLocalEntities(entity: LocalEntity): Promise<number> {
  const table = tableByEntity[entity];
  assertSafeIdentifier(table);
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE deleted_at IS NULL`);
  return row?.count ?? 0;
}

export async function listLocalEntities(entity: LocalEntity, limit = 100): Promise<LocalEntityRecord[]> {
  const table = tableByEntity[entity];
  assertSafeIdentifier(table);
  const db = await getDatabase();
  const hasNameColumn = ["centers", "circles", "teachers", "students", "sessions"].includes(table);
  const rows = hasNameColumn
    ? await db.getAllAsync<{ id: string; name: string; payloadJson: string; version: number; updatedAt: string; deletedAt: string | null }>(
        `SELECT id, name, payload_json AS payloadJson, version, updated_at AS updatedAt, deleted_at AS deletedAt
           FROM ${table} WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?`,
        limit,
      )
    : await db.getAllAsync<{ id: string; payloadJson: string; updatedAt: string; deletedAt: string | null }>(
        `SELECT id, payload_json AS payloadJson, updated_at AS updatedAt, deleted_at AS deletedAt
           FROM ${table} WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?`,
        limit,
      );
  return rows.map((row) => ({
    id: row.id,
    ...(hasNameColumn ? { name: (row as unknown as { name: string }).name } : {}),
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    version: "version" in row ? (row as { version: number }).version : 0,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }));
}
