import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveLocalMemorization, saveLocalRevision } from "./educationRepository";
import * as localRepository from "./localRepository";
import * as authorization from "../auth/authorization";

vi.mock("./localRepository", () => ({ upsertLocalEntity: vi.fn() }));
vi.mock("../auth/authorization", () => ({ assertCanAccessResource: vi.fn() }));

const actor = {
  deviceId: "device-1",
  session: {
    userId: "teacher-1",
    displayName: "المعلم",
    roles: ["teacher"],
    scopes: [{ scopeType: "circle", scopeId: "circle-1" }],
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2030-01-01T00:00:00.000Z",
    snapshotVersion: 1,
  },
};

describe("education repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queues a valid memorization range locally", async () => {
    await saveLocalMemorization(actor, {
      id: "memorization-1",
      sessionId: "session-1",
      studentId: "student-1",
      circleId: "circle-1",
      range: { fromSurah: 1, fromAyah: 1, toSurah: 1, toAyah: 7 },
      grade: "جيد",
    });
    expect(authorization.assertCanAccessResource).toHaveBeenCalled();
    expect(localRepository.upsertLocalEntity).toHaveBeenCalledWith(
      "memorization",
      expect.objectContaining({ id: "memorization-1" }),
      { userId: "teacher-1", deviceId: "device-1" },
      "UPDATE",
    );
  });

  it("rejects an invalid revision range before local write", async () => {
    await expect(saveLocalRevision(actor, {
      id: "revision-1",
      sessionId: "session-1",
      studentId: "student-1",
      circleId: "circle-1",
      range: { fromSurah: 0, fromAyah: 1, toSurah: 1, toAyah: 7 },
    })).rejects.toThrow();
    expect(localRepository.upsertLocalEntity).not.toHaveBeenCalled();
  });
});
