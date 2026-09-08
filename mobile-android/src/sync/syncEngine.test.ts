import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncPending } from "./syncEngine";
import * as outbox from "./outbox";

vi.mock("./outbox", () => ({
  listPendingOperations: vi.fn(),
  markOperationSyncing: vi.fn(),
  markOperationSynced: vi.fn(),
  markOperationFailed: vi.fn(),
}));

describe("syncPending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks accepted operations as synced", async () => {
    vi.mocked(outbox.listPendingOperations).mockResolvedValue([{
      operationId: "op-1",
      entity: "session",
      entityId: "session-1",
      operationType: "CREATE",
      payloadJson: "{}",
      userId: "user-1",
      deviceId: "device-1",
      baseVersion: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      status: "PENDING",
      lastError: null,
      nextAttemptAt: null,
    }]);

    const result = await syncPending({
      push: vi.fn().mockResolvedValue({ acceptedOperationIds: ["op-1"], conflictOperationIds: [] }),
    });

    expect(result).toEqual({ state: "COMPLETED", accepted: 1, conflicts: 0, failed: 0 });
    expect(outbox.markOperationSyncing).toHaveBeenCalledWith("op-1");
    expect(outbox.markOperationSynced).toHaveBeenCalledWith("op-1");
  });

  it("reports conflicts without silently overwriting the local record", async () => {
    vi.mocked(outbox.listPendingOperations).mockResolvedValue([{
      operationId: "op-2",
      entity: "memorization",
      entityId: "memorization-1",
      operationType: "UPDATE",
      payloadJson: "{\"from\":1,\"to\":5}",
      userId: "user-1",
      deviceId: "device-1",
      baseVersion: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
      retryCount: 0,
      status: "PENDING",
      lastError: null,
      nextAttemptAt: null,
    }]);

    const result = await syncPending({
      push: vi.fn().mockResolvedValue({ acceptedOperationIds: [], conflictOperationIds: ["op-2"] }),
    });

    expect(result.state).toBe("FAILED");
    expect(result.conflicts).toBe(1);
    expect(outbox.markOperationSynced).not.toHaveBeenCalled();
    expect(outbox.markOperationFailed).not.toHaveBeenCalled();
  });

  it("backs off when the adapter is unavailable", async () => {
    vi.mocked(outbox.listPendingOperations).mockResolvedValue([{
      operationId: "op-3",
      entity: "attendance",
      entityId: "attendance-1",
      operationType: "UPDATE",
      payloadJson: "{}",
      userId: "user-1",
      deviceId: "device-1",
      baseVersion: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      retryCount: 2,
      status: "FAILED",
      lastError: "timeout",
      nextAttemptAt: null,
    }]);

    const result = await syncPending({
      push: vi.fn().mockRejectedValue(new Error("network unavailable")),
    });

    expect(result).toEqual({ state: "FAILED", accepted: 0, conflicts: 0, failed: 1 });
    expect(outbox.markOperationFailed).toHaveBeenCalledWith("op-3", "network unavailable", 2);
  });
});
