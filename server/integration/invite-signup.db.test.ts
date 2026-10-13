/**
 * تكامل مع MySQL حقيقية: التسجيل برمز دعوة، وحدود الاستخدام المحفوظة، وقفل كود الدخول.
 */
import { describeWithDb, uniqueSuffix } from "../testing/database";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, expect, it } from "vitest";
import { academicSeasons, accessCodeAttempts, accessCodes, branches, centerMemberships, centers, circles, localCredentials, organizations, students, teacherInvites, users } from "../../drizzle/schema";
import { hashAccessCode } from "../accessCodeSecurity";
import { ENV } from "../_core/env";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { ACCESS_CODE_LOCK_AFTER, redeemAccessCodeSecure } from "../data/access-control";
import { getDb } from "../data/connection";
import { consumeDailyQuota, hitRateLimit } from "../data/usage-limits";

const original = { ...ENV };
let ip = 0;
const ctx = (): TrpcContext => ({
  user: null,
  // عنوان مختلف لكل طلب حتى لا يتدخل حد المحاولات في اختبارات التسجيل.
  req: { protocol: "https", ip: `198.51.100.${(ip += 1) % 250}`, headers: { "user-agent": "vitest" } } as unknown as TrpcContext["req"],
  res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
});

async function db() {
  const database = await getDb();
  if (!database) throw new Error("no db");
  return database;
}

type Fixture = { centerId: number; circleId: number; studentId: number; adminId: number };
let fx: Fixture;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return;
  const d = await db();
  const s = uniqueSuffix();
  const [admin] = await d.insert(users).values({ openId: `local_admin_${s}`, name: "مدير", email: `admin_${s}@t.test`, role: "super_admin" });
  const adminId = Number(admin.insertId);
  const [org] = await d.insert(organizations).values({ name: `منظمة ${s}` });
  const [center] = await d.insert(centers).values({ organizationId: Number(org.insertId), name: `مركز ${s}` });
  const centerId = Number(center.insertId);
  const [branch] = await d.insert(branches).values({ centerId, name: "الفرع الرئيسي" });
  const [season] = await d.insert(academicSeasons).values({ centerId, name: "1448", startDate: new Date("2026-09-01"), endDate: new Date("2027-06-30") });
  const [circle] = await d.insert(circles).values({ branchId: Number(branch.insertId), seasonId: Number(season.insertId), name: "حلقة الفجر" });
  const [student] = await d.insert(students).values({ centerId, name: "طالب" });
  fx = { centerId, circleId: Number(circle.insertId), studentId: Number(student.insertId), adminId };
});

afterEach(() => Object.assign(ENV, original));

describeWithDb("التسجيل برمز دعوة (MySQL)", () => {
  it("التسجيل مغلق: بلا رمز يُرفض، وبرمز غير موجود يُرفض دون إنشاء حساب", async () => {
    Object.assign(ENV, { allowSignup: false, cookieSecret: "x".repeat(40) });
    const s = uniqueSuffix();
    await expect(appRouter.createCaller(ctx()).auth.register({ name: "زائر", email: `v_${s}@t.test`, password: "Quran1234" })).rejects.toThrow("مغلق");
    await expect(appRouter.createCaller(ctx()).auth.register({ name: "زائر", email: `v_${s}@t.test`, password: "Quran1234", inviteCode: "TRTL-00000000" })).rejects.toThrow("غير صالح");
    const rows = await (await db()).select().from(users).where(eq(users.email, `v_${s}@t.test`));
    expect(rows).toHaveLength(0);
  });

  it("دعوة معلم صالحة: ينشأ الحساب ويُربط معلماً بالحلقة، ولا تُستخدم الدعوة مرتين", async () => {
    Object.assign(ENV, { allowSignup: false, cookieSecret: "x".repeat(40) });
    const d = await db();
    const code = `TRTL-${uniqueSuffix().slice(-8).toUpperCase().replace(/[^A-F0-9]/g, "A").padEnd(8, "A").slice(0, 8)}`;
    await d.insert(teacherInvites).values({ centerId: fx.centerId, circleId: fx.circleId, code, role: "teacher", createdBy: fx.adminId, expiresAt: new Date(Date.now() + 86_400_000) });
    const s = uniqueSuffix();
    const result = await appRouter.createCaller(ctx()).auth.register({ name: "المعلم أحمد", email: `teacher_${s}@t.test`, password: "Quran1234", inviteCode: code.toLowerCase() });
    expect(result).toEqual({ success: true, role: "teacher" });
    const [user] = await d.select().from(users).where(eq(users.email, `teacher_${s}@t.test`));
    expect(user.role).toBe("teacher");
    const [circle] = await d.select().from(circles).where(eq(circles.id, fx.circleId));
    expect(circle.teacherId).toBeTruthy();
    const [invite] = await d.select().from(teacherInvites).where(eq(teacherInvites.code, code));
    expect(invite.usedByUserId).toBe(user.id);

    await expect(appRouter.createCaller(ctx()).auth.register({ name: "آخر", email: `other_${s}@t.test`, password: "Quran1234", inviteCode: code })).rejects.toThrow("غير صالح");
    expect(await d.select().from(users).where(eq(users.email, `other_${s}@t.test`))).toHaveLength(0);
  });

  it("كود دخول طالب صالح: ينشأ الحساب بدور طالب وعضوية في المركز", async () => {
    Object.assign(ENV, { allowSignup: false, cookieSecret: "x".repeat(40) });
    const d = await db();
    const raw = `TRT-${uniqueSuffix().toUpperCase()}`;
    await d.insert(accessCodes).values({ centerId: fx.centerId, codeHash: hashAccessCode(raw), codeHint: "••••", role: "student", studentId: fx.studentId, scopeJson: JSON.stringify([{ scopeType: "student", scopeId: fx.studentId }]), createdBy: fx.adminId, maxUses: 1 });
    const s = uniqueSuffix();
    const result = await appRouter.createCaller(ctx()).auth.register({ name: "الطالب", email: `student_${s}@t.test`, password: "Quran1234", inviteCode: raw });
    expect(result.role).toBe("student");
    const [user] = await d.select().from(users).where(eq(users.email, `student_${s}@t.test`));
    const memberships = await d.select().from(centerMemberships).where(and(eq(centerMemberships.userId, user.id), eq(centerMemberships.centerId, fx.centerId)));
    expect(memberships[0]?.role).toBe("student");
  });

  it("إن فشل الاسترداد بعد الفحص يُلغى الحساب الجديد ويتحرر البريد", async () => {
    Object.assign(ENV, { allowSignup: false, cookieSecret: "x".repeat(40) });
    const d = await db();
    // كود طالب بلا studentId: يجتاز الفحص المبدئي (نشط وغير منتهٍ) ويفشل عند الاسترداد.
    const raw = `TRT-${uniqueSuffix().toUpperCase()}`;
    await d.insert(accessCodes).values({ centerId: fx.centerId, codeHash: hashAccessCode(raw), codeHint: "••••", role: "student", createdBy: fx.adminId, maxUses: 1 });
    const s = uniqueSuffix();
    await expect(appRouter.createCaller(ctx()).auth.register({ name: "الطالب", email: `broken_${s}@t.test`, password: "Quran1234", inviteCode: raw })).rejects.toThrow();
    const [user] = await d.select().from(users).where(eq(users.email, `broken_${s}@t.test`));
    expect(user.deletedAt).not.toBeNull();
    expect(user.isActive).toBe(false);
    expect(await d.select().from(localCredentials).where(eq(localCredentials.email, `broken_${s}@t.test`))).toHaveLength(0);
  });
});

describeWithDb("قفل كود الدخول بعد المحاولات الفاشلة (MySQL)", () => {
  it("المحاولات الفاشلة تُحفظ رغم التراجع عن المعاملة، فيُقفل الكود ثم يُعطَّل", async () => {
    const d = await db();
    const raw = `TRT-${uniqueSuffix().toUpperCase()}`;
    // كود طالب بلا studentId يفشل في كل استرداد دون أن يُعطَّل فوراً.
    const [inserted] = await d.insert(accessCodes).values({ centerId: fx.centerId, codeHash: hashAccessCode(raw), codeHint: "••••", role: "student", createdBy: fx.adminId, maxUses: 1, lockedUntil: new Date(Date.now() + 60_000) });
    const id = Number(inserted.insertId);
    for (let i = 0; i < ACCESS_CODE_LOCK_AFTER; i++) {
      await expect(redeemAccessCodeSecure({ codeHash: hashAccessCode(raw), userId: fx.adminId })).rejects.toThrow("تعليق");
    }
    const [row] = await d.select().from(accessCodes).where(eq(accessCodes.id, id));
    expect(row.failedAttempts).toBe(ACCESS_CODE_LOCK_AFTER);
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    const attempts = await d.select().from(accessCodeAttempts).where(eq(accessCodeAttempts.accessCodeId, id));
    expect(attempts).toHaveLength(ACCESS_CODE_LOCK_AFTER);
  });

  it("كود غير نشط يُعطَّل ويُسجَّل، وكود غير موجود يُسجَّل بلا رقم كود", async () => {
    const d = await db();
    const raw = `TRT-${uniqueSuffix().toUpperCase()}`;
    const [inserted] = await d.insert(accessCodes).values({ centerId: fx.centerId, codeHash: hashAccessCode(raw), codeHint: "••••", role: "student", createdBy: fx.adminId, expiresAt: new Date(Date.now() - 1000) });
    await expect(redeemAccessCodeSecure({ codeHash: hashAccessCode(raw), userId: fx.adminId })).rejects.toThrow("انتهت");
    const [row] = await d.select().from(accessCodes).where(eq(accessCodes.id, Number(inserted.insertId)));
    expect(row.status).toBe("disabled");
    expect(row.failedAttempts).toBe(1);

    const missing = hashAccessCode(`TRT-${uniqueSuffix().toUpperCase()}`);
    await expect(redeemAccessCodeSecure({ codeHash: missing, userId: fx.adminId })).rejects.toThrow("غير صحيح");
    expect(await d.select().from(accessCodeAttempts).where(eq(accessCodeAttempts.codeFingerprint, missing))).toHaveLength(1);
  });
});

describeWithDb("حدود الاستخدام المحفوظة في MySQL", () => {
  it("حد المحاولات يُحفظ في الجدول ويعيد الفتح بعد انتهاء النافذة", async () => {
    const key = `test:${uniqueSuffix()}`;
    const now = Date.now();
    for (let i = 0; i < 3; i++) expect(await hitRateLimit(key, { max: 3, windowMs: 60_000, now })).toBe(true);
    expect(await hitRateLimit(key, { max: 3, windowMs: 60_000, now })).toBe(false);
    expect(await hitRateLimit(key, { max: 3, windowMs: 60_000, now: now + 61_000 })).toBe(true);
  });

  it("المحاولات المتزامنة تُعد كلها (لا يضيع تحديث)", async () => {
    const key = `test:${uniqueSuffix()}`;
    const results = await Promise.all(Array.from({ length: 30 }, () => hitRateLimit(key, { max: 20, windowMs: 60_000 })));
    expect(results.filter(Boolean)).toHaveLength(20);
  });

  it("حصة المساعد اليومية تُحفظ لكل مستخدم وكل يوم", async () => {
    const userId = 900_000 + Math.floor(Math.random() * 99_999);
    const day = new Date("2026-10-13T08:00:00Z");
    expect(await consumeDailyQuota(userId, 2, day)).toBe(true);
    expect(await consumeDailyQuota(userId, 2, day)).toBe(true);
    expect(await consumeDailyQuota(userId, 2, day)).toBe(false);
    expect(await consumeDailyQuota(userId, 2, new Date("2026-10-14T08:00:00Z"))).toBe(true);
  });
});
