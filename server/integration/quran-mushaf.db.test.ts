/**
 * تكامل مع MySQL: حالة القراءة في المصحف («الأحدث يغلب» لكل حقل) والمراجعة المتباعدة لصاحب الحساب فقط.
 */
import { describeWithDb, uniqueSuffix } from "../testing/database";
import { eq } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";
import { users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";

type User = NonNullable<TrpcContext["user"]>;
const ctx = (user: User): TrpcContext => ({
  user,
  req: {
    protocol: "https",
    ip: "198.51.100.8",
    headers: { "user-agent": "vitest" },
  } as unknown as TrpcContext["req"],
  res: {
    cookie: () => undefined,
    clearCookie: () => undefined,
  } as unknown as TrpcContext["res"],
});

let reader: User;
let other: User;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return;
  const d = (await getDb())!;
  const make = async (name: string) => {
    const [row] = await d.insert(users).values({
      openId: `local_q_${uniqueSuffix()}`,
      name,
      role: "student",
    });
    return (
      await d
        .select()
        .from(users)
        .where(eq(users.id, Number(row.insertId)))
    )[0] as User;
  };
  reader = await make("قارئ");
  other = await make("آخر");
});

describeWithDb("قسم المصحف (MySQL)", () => {
  it("يحفظ الأحدث لكل حقل ويتجاهل النسخة الأقدم", async () => {
    const caller = appRouter.createCaller(ctx(reader));
    const newer = new Date(Date.now() - 1_000).toISOString();
    const older = new Date(Date.now() - 60_000).toISOString();
    const first = await caller.quranReadingState.sync({
      bookmarks: [{ id: "2:255", surah: 2, ayah: 255 }],
      bookmarksAt: newer,
    });
    expect(first.bookmarks).toEqual([{ id: "2:255", surah: 2, ayah: 255 }]);

    const stale = await caller.quranReadingState.sync({
      bookmarks: [],
      bookmarksAt: older,
    });
    expect(stale.bookmarks).toEqual([{ id: "2:255", surah: 2, ayah: 255 }]);

    const readOnly = await appRouter
      .createCaller(ctx(other))
      .quranReadingState.sync({});
    expect(readOnly.bookmarks).toBeNull();
  });

  it("«أتقنتُها» ينشئ بطاقة مراجعة بعد يوم ثم أربعة أيام", async () => {
    const caller = appRouter.createCaller(ctx(reader));
    const first = await caller.quranReview.markMastered({
      surahNumber: 112,
      fromAyah: 1,
      toAyah: 4,
    });
    expect(first.interval_days).toBe(1);
    const second = await caller.quranReview.markMastered({
      surahNumber: 112,
      fromAyah: 1,
      toAyah: 4,
    });
    expect(second.interval_days).toBe(4);
    expect(await appRouter.createCaller(ctx(other)).quranReview.due()).toEqual(
      []
    );
  });

  it("يرفض مقطعاً يتجاوز آيات السورة", async () => {
    const caller = appRouter.createCaller(ctx(reader));
    await expect(
      caller.quranReview.markMastered({
        surahNumber: 112,
        fromAyah: 1,
        toAyah: 9,
      })
    ).rejects.toThrow();
  });
});
