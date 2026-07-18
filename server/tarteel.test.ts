import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@tarteel.com",
    name: "مدير النظام",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("auth", () => {
  it("me returns null for unauthenticated user", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated user", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("مدير النظام");
    expect(result?.role).toBe("admin");
  });

  it("logout clears session cookie", async () => {
    const { ctx, clearedCookies } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies).toHaveLength(1);
  });
});

describe("shared types", () => {
  it("GRADE_LABELS contains all grades", async () => {
    const { GRADE_LABELS } = await import("../shared/types");
    expect(GRADE_LABELS.excellent).toBe("ممتاز");
    expect(GRADE_LABELS.very_good).toBe("جيد جداً");
    expect(GRADE_LABELS.good).toBe("جيد");
    expect(GRADE_LABELS.acceptable).toBe("مقبول");
    expect(GRADE_LABELS.weak).toBe("ضعيف");
    expect(GRADE_LABELS.not_done).toBe("لم يؤدِ");
  });

  it("SESSION_STATUS_LABELS contains all statuses", async () => {
    const { SESSION_STATUS_LABELS } = await import("../shared/types");
    expect(SESSION_STATUS_LABELS.scheduled).toBe("مجدولة");
    expect(SESSION_STATUS_LABELS.open).toBe("مفتوحة");
    expect(SESSION_STATUS_LABELS.closed).toBe("مغلقة");
    expect(SESSION_STATUS_LABELS.cancelled).toBe("ملغاة");
  });

  it("QURAN_SURAHS contains 114 surahs", async () => {
    const { QURAN_SURAHS } = await import("../shared/types");
    expect(QURAN_SURAHS).toHaveLength(114);
    expect(QURAN_SURAHS[0]?.name).toBe("الفاتحة");
    expect(QURAN_SURAHS[113]?.name).toBe("الناس");
  });

  it("ATTENDANCE_LABELS has correct Arabic labels", async () => {
    const { ATTENDANCE_LABELS } = await import("../shared/types");
    expect(ATTENDANCE_LABELS.present).toBe("حاضر");
    expect(ATTENDANCE_LABELS.absent).toBe("غائب");
    expect(ATTENDANCE_LABELS.late).toBe("متأخر");
    expect(ATTENDANCE_LABELS.excused).toBe("معذور");
  });
});
