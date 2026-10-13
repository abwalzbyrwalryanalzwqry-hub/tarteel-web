/**
 * تكامل مع MySQL: حذف المستخدم حسابه بنفسه.
 * يُحذف ما يخص الحساب، وتبقى سجلات المركز مفكوكة عن الحساب، ولا يمكن الدخول بعدها بأي معرّف.
 */
import { describeWithDb, uniqueSuffix } from "../testing/database";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  auditLog,
  centerMemberships,
  centers,
  localCredentials,
  notifications,
  organizations,
  parentStudentLinks,
  quranBookmarks,
  students,
  users,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";
import { resetRateLimitsForTests } from "../auth/password";
import {
  DELETED_USER_NAME,
  DELETE_CONFIRMATION_PHRASE,
} from "../auth/accountDeletion";

const original = { ...ENV };
let ip = 0;
let cleared: string[] = [];
const ctx = (user: TrpcContext["user"] = null): TrpcContext => ({
  user,
  req: {
    protocol: "https",
    ip: `203.0.113.${(ip += 1) % 250}`,
    headers: { "user-agent": "vitest" },
  } as unknown as TrpcContext["req"],
  res: {
    cookie: () => undefined,
    clearCookie: (name: string) => cleared.push(name),
  } as unknown as TrpcContext["res"],
});
const db = async () => (await getDb())!;
const PASSWORD = "Quran1234";

async function registered(name = "مستخدم") {
  const email = `del_${uniqueSuffix()}@t.test`;
  await appRouter
    .createCaller(ctx())
    .auth.register({ name, email, password: PASSWORD });
  const [user] = await (
    await db()
  )
    .select()
    .from(users)
    .where(eq(users.email, email));
  return { user, email };
}

async function centerWith(managerId: number) {
  const d = await db();
  const s = uniqueSuffix();
  const [org] = await d.insert(organizations).values({ name: `منظمة ${s}` });
  const [center] = await d.insert(centers).values({
    organizationId: Number(org.insertId),
    name: `مركز ${s}`,
    managerId,
  });
  const centerId = Number(center.insertId);
  await d.insert(centerMemberships).values({
    userId: managerId,
    centerId,
    role: "center_manager",
    status: "active",
    isOwner: true,
  });
  return centerId;
}

beforeEach(() => {
  cleared = [];
  resetRateLimitsForTests();
  Object.assign(ENV, { allowSignup: true, cookieSecret: "x".repeat(40) });
});
afterEach(() => Object.assign(ENV, original));

describeWithDb("حذف الحساب (MySQL)", () => {
  it("يحذف بيانات الحساب ويُبقي سجل الطالب للمركز بلا ربط، ثم يرفض الدخول", async () => {
    const d = await db();
    const { user: manager } = await registered("مدير المركز");
    const centerId = await centerWith(manager.id);
    const { user, email } = await registered("ولي أمر");

    const [student] = await d
      .insert(students)
      .values({ centerId, name: "الطالب", guardianUserId: user.id });
    const studentId = Number(student.insertId);
    await d.insert(parentStudentLinks).values({
      guardianUserId: user.id,
      studentId,
      centerId,
    });
    await d.insert(centerMemberships).values({
      userId: user.id,
      centerId,
      role: "guardian",
      status: "active",
    });
    await d.insert(quranBookmarks).values({
      userId: user.id,
      referenceType: "page",
      referenceKey: "page:1",
      pageNumber: 1,
    });
    await d
      .insert(notifications)
      .values({ userId: user.id, title: "تنبيه", message: "نص" });
    await d.insert(auditLog).values({
      userId: user.id,
      action: "test.event",
      entity: "test",
      ipAddress: "203.0.113.9",
      userAgent: "vitest",
    });

    const caller = appRouter.createCaller(ctx(user));
    const status = await caller.auth.deletionStatus();
    expect(status).toMatchObject({
      blocker: null,
      requiresPassword: true,
      confirmationPhrase: DELETE_CONFIRMATION_PHRASE,
      counts: { bookmarks: 1, notifications: 1, centers: 1 },
    });

    await expect(
      caller.auth.deleteAccount({ confirmation: "نعم", password: PASSWORD })
    ).rejects.toThrow(DELETE_CONFIRMATION_PHRASE);
    await expect(
      caller.auth.deleteAccount({
        confirmation: DELETE_CONFIRMATION_PHRASE,
        password: "wrong-pass",
      })
    ).rejects.toThrow("كلمة المرور غير صحيحة");

    const result = await caller.auth.deleteAccount({
      confirmation: DELETE_CONFIRMATION_PHRASE,
      password: PASSWORD,
    });
    expect(result).toEqual({ success: true });
    expect(cleared.length).toBeGreaterThan(0);

    const [after] = await d.select().from(users).where(eq(users.id, user.id));
    expect(after).toMatchObject({
      name: DELETED_USER_NAME,
      email: null,
      phone: null,
      isActive: false,
      accountStatus: "archived",
    });
    expect(after.deletedAt).toBeTruthy();
    expect(after.openId).toMatch(/^deleted_/);
    expect(after.sessionVersion).toBe(user.sessionVersion + 1);

    for (const [table, column] of [
      [localCredentials, localCredentials.userId],
      [quranBookmarks, quranBookmarks.userId],
      [notifications, notifications.userId],
      [centerMemberships, centerMemberships.userId],
      [parentStudentLinks, parentStudentLinks.guardianUserId],
    ] as const) {
      expect(await d.select().from(table).where(eq(column, user.id))).toEqual(
        []
      );
    }

    const [keptStudent] = await d
      .select()
      .from(students)
      .where(eq(students.id, studentId));
    expect(keptStudent).toMatchObject({ name: "الطالب", guardianUserId: null });

    const events = await d
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, user.id));
    expect(events.every(row => row.ipAddress === null)).toBe(true);
    expect(events.map(row => row.action)).toContain("auth.account_deleted");

    await expect(
      appRouter
        .createCaller(ctx())
        .auth.login({ identifier: email, password: PASSWORD })
    ).rejects.toThrow();

    // البريد صار متاحاً لحساب جديد.
    await appRouter
      .createCaller(ctx())
      .auth.register({ name: "جديد", email, password: PASSWORD });
  });

  it("يمنع حذف حساب المدير الوحيد لمركز، ويسمح به بعد إضافة مدير آخر", async () => {
    const d = await db();
    const { user: manager } = await registered("المدير");
    const centerId = await centerWith(manager.id);
    const caller = appRouter.createCaller(ctx(manager));

    const status = await caller.auth.deletionStatus();
    expect(status.blocker).toContain("المدير الوحيد");
    await expect(
      caller.auth.deleteAccount({
        confirmation: DELETE_CONFIRMATION_PHRASE,
        password: PASSWORD,
      })
    ).rejects.toThrow("المدير الوحيد");
    const [still] = await d
      .select()
      .from(users)
      .where(eq(users.id, manager.id));
    expect(still.deletedAt).toBeNull();

    const { user: second } = await registered("مدير ثانٍ");
    await d.insert(centerMemberships).values({
      userId: second.id,
      centerId,
      role: "center_manager",
      status: "active",
    });
    expect((await caller.auth.deletionStatus()).blocker).toBeNull();
    await caller.auth.deleteAccount({
      confirmation: DELETE_CONFIRMATION_PHRASE,
      password: PASSWORD,
    });
    const remaining = await d
      .select()
      .from(centerMemberships)
      .where(
        and(
          eq(centerMemberships.centerId, centerId),
          eq(centerMemberships.role, "center_manager")
        )
      );
    expect(remaining.map(row => row.userId)).toEqual([second.id]);
  });

  it("يرفض حذف حساب المدير العام", async () => {
    const d = await db();
    const { user } = await registered("مدير عام");
    await d
      .update(users)
      .set({ role: "super_admin" })
      .where(eq(users.id, user.id));
    const admin = { ...user, role: "super_admin" as const };
    await expect(
      appRouter.createCaller(ctx(admin)).auth.deleteAccount({
        confirmation: DELETE_CONFIRMATION_PHRASE,
        password: PASSWORD,
      })
    ).rejects.toThrow("المدير العام");
  });

  it("حساب بلا كلمة مرور (Google) يكفيه نص التأكيد", async () => {
    const d = await db();
    const s = uniqueSuffix();
    const [row] = await d.insert(users).values({
      openId: `google_${s}`,
      name: "مستخدم Google",
      email: `g_${s}@t.test`,
      loginMethod: "google",
    });
    const [user] = await d
      .select()
      .from(users)
      .where(eq(users.id, Number(row.insertId)));
    const caller = appRouter.createCaller(ctx(user));
    expect((await caller.auth.deletionStatus()).requiresPassword).toBe(false);
    await caller.auth.deleteAccount({
      confirmation: DELETE_CONFIRMATION_PHRASE,
    });
    const [after] = await d.select().from(users).where(eq(users.id, user.id));
    expect(after.deletedAt).toBeTruthy();
  });
});
