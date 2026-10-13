/**
 * تكامل مع MySQL: لا يُنشئ مستخدم إشعاراً لغيره، ولا يعلّم إشعار غيره مقروءاً.
 */
import { describeWithDb, uniqueSuffix } from "../testing/database";
import { eq } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";
import { notifications, users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";

type User = NonNullable<TrpcContext["user"]>;
const ctx = (user: User): TrpcContext => ({
  user,
  req: {
    protocol: "https",
    ip: "198.51.100.7",
    headers: { "user-agent": "vitest" },
  } as unknown as TrpcContext["req"],
  res: {
    cookie: () => undefined,
    clearCookie: () => undefined,
  } as unknown as TrpcContext["res"],
});
const db = async () => (await getDb())!;

let alice: User;
let bob: User;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return;
  const d = await db();
  const make = async (name: string) => {
    const [row] = await d.insert(users).values({
      openId: `local_n_${uniqueSuffix()}`,
      name,
      role: "teacher",
    });
    return (
      await d
        .select()
        .from(users)
        .where(eq(users.id, Number(row.insertId)))
    )[0] as User;
  };
  alice = await make("علياء");
  bob = await make("بكر");
});

const notificationsOf = async (userId: number) =>
  (await db())
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));

describeWithDb("ملكية الإشعارات (MySQL)", () => {
  it("الإشعار التجريبي يصل صاحب الحساب فقط", async () => {
    const caller = appRouter.createCaller(ctx(alice));
    await caller.notifications.create({
      title: "تجربة",
      message: "إشعار تجريبي",
    });
    expect((await notificationsOf(alice.id)).map(n => n.title)).toContain(
      "تجربة"
    );
    // معرّف المستخدم نفسه مقبول للتوافق مع الواجهات القديمة.
    await caller.notifications.create({
      userId: alice.id,
      title: "تجربة 2",
      message: "إشعار تجريبي",
    });
  });

  it("يرفض إنشاء إشعار لمستخدم آخر ولا يحفظ شيئاً", async () => {
    const before = (await notificationsOf(bob.id)).length;
    await expect(
      appRouter.createCaller(ctx(alice)).notifications.create({
        userId: bob.id,
        title: "تم تفعيل الوصول",
        message: "رسالة مزيفة",
        type: "success",
      })
    ).rejects.toThrow("مستخدم آخر");
    expect(await notificationsOf(bob.id)).toHaveLength(before);
  });

  it("يرفض أنواع الإشعارات الداخلية والنصوص الفارغة أو الطويلة", async () => {
    const caller = appRouter.createCaller(ctx(alice));
    await expect(
      caller.notifications.create({
        title: "x",
        message: "y",
        type: "session" as "info",
      })
    ).rejects.toThrow();
    await expect(
      caller.notifications.create({ title: "  ", message: "y" })
    ).rejects.toThrow();
    await expect(
      caller.notifications.create({ title: "x", message: "ب".repeat(2001) })
    ).rejects.toThrow();
  });

  it("لا يعلّم إشعار مستخدم آخر مقروءاً", async () => {
    const d = await db();
    const [row] = await d.insert(notifications).values({
      userId: bob.id,
      title: "لبكر",
      message: "خاص",
    });
    const id = Number(row.insertId);
    await expect(
      appRouter.createCaller(ctx(alice)).notifications.markRead({ id })
    ).rejects.toThrow("غير موجود");
    const [stillUnread] = await d
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    expect(stillUnread.isRead).toBe(false);

    await appRouter.createCaller(ctx(bob)).notifications.markRead({ id });
    const [read] = await d
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    expect(read.isRead).toBe(true);
  });
});
