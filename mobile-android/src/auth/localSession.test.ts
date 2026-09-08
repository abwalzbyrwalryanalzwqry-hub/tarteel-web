import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalSession, loadLocalSession, saveLocalSession, type LocalSession } from "./localSession";

const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  setItemAsync: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  deleteItemAsync: vi.fn(async (key: string) => { store.delete(key); }),
}));

const session: LocalSession = {
  userId: "user-1",
  displayName: "المعلم",
  roles: ["teacher"],
  scopes: [{ scopeType: "circle", scopeId: "circle-1" }],
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-02-01T00:00:00.000Z",
  snapshotVersion: 1,
};

describe("local session", () => {
  beforeEach(() => store.clear());

  it("stores and reads a non-expired session", async () => {
    await saveLocalSession(session);
    await expect(loadLocalSession(new Date("2026-01-15T00:00:00.000Z"))).resolves.toEqual(session);
  });

  it("deletes an expired session instead of returning stale permissions", async () => {
    await saveLocalSession(session);
    await expect(loadLocalSession(new Date("2026-02-01T00:00:00.000Z"))).resolves.toBeNull();
    await expect(loadLocalSession(new Date("2026-01-15T00:00:00.000Z"))).resolves.toBeNull();
  });

  it("supports explicit logout cleanup", async () => {
    await saveLocalSession(session);
    await clearLocalSession();
    await expect(loadLocalSession(new Date("2026-01-15T00:00:00.000Z"))).resolves.toBeNull();
  });
});
