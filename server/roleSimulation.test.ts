import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { protectedProcedure, router } from "./_core/trpc";

const simulationRouter = router({
  read: protectedProcedure.query(() => ({ ok: true })),
  write: protectedProcedure.mutation(() => ({ ok: true })),
});

function makeContext(simulation: boolean): TrpcContext {
  return {
    user: { id: 1, openId: "simulation-owner", name: "مالك تجريبي", email: "owner@example.test", loginMethod: "manus", role: "admin", isActive: true, accountStatus: "active", accessRevokedAt: null, phone: null, avatar: null, lastActiveAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: simulation ? { "x-tarteel-role-simulation": "1" } : {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("حاجز محاكاة الدور", () => {
  it("يبقي الاستعلامات متاحة للمعاينة ويمنع أي mutation محمي", async () => {
    const caller = simulationRouter.createCaller(makeContext(true));
    await expect(caller.read()).resolves.toEqual({ ok: true });
    await expect(caller.write()).rejects.toMatchObject({ code: "FORBIDDEN", message: "لا يمكن تنفيذ إجراءات تعديل أثناء محاكاة الدور" });
  });

  it("لا يغير سلوك التعديلات العادية عندما لا تكون المحاكاة مفعلة", async () => {
    const caller = simulationRouter.createCaller(makeContext(false));
    await expect(caller.write()).resolves.toEqual({ ok: true });
  });
});
