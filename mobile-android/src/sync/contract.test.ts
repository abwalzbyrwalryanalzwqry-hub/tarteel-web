import { describe, expect, it } from "vitest";
import { syncPullRequestSchema, syncPushRequestSchema } from "./contract";

describe("sync contract", () => {
  it("accepts a bounded push request", () => {
    const result = syncPushRequestSchema.safeParse({
      deviceId: "device-1",
      cursor: null,
      operations: [{
        operationId: "operation-1",
        entity: "attendance",
        entityId: "attendance-1",
        operationType: "UPDATE",
        payloadJson: "{}",
        userId: "user-1",
        deviceId: "device-1",
        baseVersion: 3,
        createdAt: "2026-01-01T00:00:00.000Z",
      }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an oversized pull limit", () => {
    const result = syncPullRequestSchema.safeParse({
      deviceId: "device-1",
      cursor: null,
      scope: [],
      limit: 201,
    });
    expect(result.success).toBe(false);
  });
});
