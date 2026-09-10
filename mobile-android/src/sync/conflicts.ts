import { getDatabase } from "../db/database";

export type LocalSyncConflict = {
  conflictId: string;
  operationId: string;
  entity: string;
  entityId: string;
  localJson: string;
  remoteJson: string;
  detectedAt: string;
  resolution: "PENDING" | "LOCAL" | "REMOTE";
  resolvedAt: string | null;
};

export async function listPendingConflicts(limit = 50): Promise<LocalSyncConflict[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const db = await getDatabase();
  return db.getAllAsync<LocalSyncConflict>(
    `SELECT conflict_id AS conflictId, operation_id AS operationId, entity, entity_id AS entityId,
            local_json AS localJson, remote_json AS remoteJson, detected_at AS detectedAt,
            resolution, resolved_at AS resolvedAt
       FROM sync_conflicts
      WHERE resolution = 'PENDING'
      ORDER BY detected_at DESC
      LIMIT ?`,
    safeLimit,
  );
}
