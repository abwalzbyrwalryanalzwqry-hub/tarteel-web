import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";

export type OutboxOperationType = "CREATE" | "UPDATE" | "DELETE";
export type OutboxStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export type OutboxOperation = {
  operationId: string;
  entity: string;
  entityId: string;
  operationType: OutboxOperationType;
  payloadJson: string;
  userId: string;
  deviceId: string;
  baseVersion: number | null;
  createdAt: string;
  retryCount: number;
  status: OutboxStatus;
  lastError: string | null;
  nextAttemptAt: string | null;
};

export async function enqueueOperation(input: Omit<OutboxOperation, "operationId" | "createdAt" | "retryCount" | "status" | "lastError" | "nextAttemptAt">): Promise<string> {
  const db = await getDatabase();
  const operationId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_outbox
      (operation_id, entity, entity_id, operation_type, payload_json, user_id, device_id, base_version, created_at, retry_count, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING')`,
    operationId,
    input.entity,
    input.entityId,
    input.operationType,
    input.payloadJson,
    input.userId,
    input.deviceId,
    input.baseVersion,
    createdAt,
  );
  return operationId;
}

export async function listPendingOperations(limit = 50): Promise<OutboxOperation[]> {
  const db = await getDatabase();
  return db.getAllAsync<OutboxOperation>(
    `SELECT operation_id AS operationId, entity, entity_id AS entityId, operation_type AS operationType,
            payload_json AS payloadJson, user_id AS userId, device_id AS deviceId, base_version AS baseVersion,
            created_at AS createdAt, retry_count AS retryCount, status, last_error AS lastError,
            next_attempt_at AS nextAttemptAt
       FROM sync_outbox
      WHERE status IN ('PENDING', 'FAILED')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at ASC
      LIMIT ?`,
    new Date().toISOString(),
    limit,
  );
}

export async function markOperationSyncing(operationId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE sync_outbox SET status = 'SYNCING' WHERE operation_id = ?`, operationId);
}

export async function markOperationSynced(operationId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE sync_outbox SET status = 'SYNCED', last_error = NULL WHERE operation_id = ?`, operationId);
}

export async function markOperationConflict(
  operationId: string,
  details: { entity: string; entityId: string; localJson: string; remoteJson: string; message?: string },
): Promise<void> {
  const db = await getDatabase();
  const detectedAt = new Date().toISOString();
  await db.execAsync("BEGIN IMMEDIATE;");
  try {
    await db.runAsync(`UPDATE sync_outbox SET status = 'CONFLICT', last_error = ? WHERE operation_id = ?`, (details.message ?? "تعارض في نسخة السجل").slice(0, 1000), operationId);
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_conflicts (conflict_id, operation_id, entity, entity_id, local_json, remote_json, detected_at, resolution)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      `${operationId}:conflict`, operationId, details.entity, details.entityId, details.localJson, details.remoteJson, detectedAt,
    );
    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function resolveOperationConflict(operationId: string, resolution: "LOCAL" | "REMOTE"): Promise<void> {
  const db = await getDatabase();
  const resolvedAt = new Date().toISOString();
  await db.execAsync("BEGIN IMMEDIATE;");
  try {
    await db.runAsync(`UPDATE sync_conflicts SET resolution = ?, resolved_at = ? WHERE operation_id = ? AND resolution = 'PENDING'`, resolution, resolvedAt, operationId);
    await db.runAsync(`UPDATE sync_outbox SET status = ?, last_error = NULL WHERE operation_id = ?`, resolution === "LOCAL" ? "PENDING" : "SYNCED", operationId);
    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function markOperationFailed(operationId: string, errorMessage: string, retryCount: number): Promise<void> {
  const db = await getDatabase();
  const delayMs = Math.min(30 * 60 * 1000, 1000 * 2 ** Math.min(retryCount, 10));
  const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
  await db.runAsync(
    `UPDATE sync_outbox
        SET status = 'FAILED', retry_count = ?, last_error = ?, next_attempt_at = ?
      WHERE operation_id = ?`,
    retryCount + 1,
    errorMessage.slice(0, 1000),
    nextAttemptAt,
    operationId,
  );
}
