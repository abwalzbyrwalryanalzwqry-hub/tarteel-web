import { listPendingOperations, markOperationConflict, markOperationFailed, markOperationSynced, markOperationSyncing, type OutboxOperation } from "./outbox";

export type SyncState = "IDLE" | "SYNCING" | "COMPLETED" | "FAILED";

export type SyncAdapter = {
  push: (operations: OutboxOperation[]) => Promise<{ acceptedOperationIds: string[]; conflictOperationIds: string[] }>;
};

export type SyncResult = {
  state: SyncState;
  accepted: number;
  conflicts: number;
  failed: number;
};

let running = false;

export async function syncPending(adapter: SyncAdapter, limit = 50): Promise<SyncResult> {
  if (running) return { state: "SYNCING", accepted: 0, conflicts: 0, failed: 0 };
  running = true;

  try {
    const operations = await listPendingOperations(limit);
    if (operations.length === 0) return { state: "COMPLETED", accepted: 0, conflicts: 0, failed: 0 };

    await Promise.all(operations.map((operation) => markOperationSyncing(operation.operationId)));
    try {
      const result = await adapter.push(operations);
      const accepted = new Set(result.acceptedOperationIds);
      const conflicts = new Set(result.conflictOperationIds);
      await Promise.all(operations.map(async (operation) => {
        if (accepted.has(operation.operationId)) {
          await markOperationSynced(operation.operationId);
        } else if (conflicts.has(operation.operationId)) {
          await markOperationConflict(operation.operationId);
          return;
        } else {
          await markOperationFailed(operation.operationId, "لم يؤكد الخادم العملية", operation.retryCount);
        }
      }));
      return { state: conflicts.size > 0 ? "FAILED" : "COMPLETED", accepted: accepted.size, conflicts: conflicts.size, failed: operations.length - accepted.size - conflicts.size };
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل غير معروف في المزامنة";
      await Promise.all(operations.map((operation) => markOperationFailed(operation.operationId, message, operation.retryCount)));
      return { state: "FAILED", accepted: 0, conflicts: 0, failed: operations.length };
    }
  } finally {
    running = false;
  }
}
