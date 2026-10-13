/**
 * حذف المستخدم حسابه بنفسه (مطلب Google Play لكل تطبيق يتيح إنشاء الحسابات، وحق للمستخدم).
 *
 * ما يُحذف نهائياً: بيانات الدخول (كلمة المرور، البريد، الهاتف، ربط Google)، وروابط التعيين والاستعادة،
 * وعلامات المصحف وتفضيلات الآيات، والإشعارات، وعدّاد المساعد، وكل عضويات المراكز وصلاحياتها ونطاقاتها،
 * وروابط ولي الأمر بالطلاب. ويُمحى عنوان IP ووكيل المتصفح من سجل التدقيق ومحاولات الأكواد.
 *
 * ما يبقى: صف المستخدم مجهول الهوية («حساب محذوف») حتى لا تنكسر المراجع في السجلات القديمة، وسجلات
 * المركز التعليمية (الطالب، الحضور، الحفظ، التقييم، الجلسات) لأنها بيانات المركز لا بيانات الحساب؛
 * يُفك ربطها بالحساب فقط، وحذفها من صلاحية إدارة المركز.
 */
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  accessCodeAttempts,
  accessCodes,
  aiDailyUsage,
  auditLog,
  centerMemberships,
  centers,
  localCredentials,
  notifications,
  oauthAccounts,
  parentStudentLinks,
  passwordSetupTokens,
  permissionGrants,
  quranBookmarks,
  quranVersePreferences,
  students,
  teachers,
  userScopes,
  users,
} from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import { logger } from "../_core/logger";
import { protectedProcedure } from "../_core/trpc";
import { getDb } from "../data/connection";
import {
  PASSWORD_MAX_LENGTH,
  consumeRateLimit,
  verifyPassword,
} from "./password";

/** عبارة التأكيد التي يكتبها المستخدم بنفسه قبل الحذف. */
export const DELETE_CONFIRMATION_PHRASE = "احذف حسابي";
export const DELETED_USER_NAME = "حساب محذوف";

const PLATFORM_ADMIN_ROLES = new Set(["admin", "super_admin"]);

const fail = (code: TRPCError["code"], message: string) =>
  new TRPCError({ code, message });

async function requireDb() {
  const database = await getDb();
  if (!database)
    throw fail("INTERNAL_SERVER_ERROR", "قاعدة البيانات غير متاحة");
  return database;
}

/**
 * المراكز التي يديرها المستخدم وحده: حذف حسابه يتركها بلا مدير، فيُطلب منه أولاً إضافة مدير آخر.
 * المدير هو `centers.managerId` أو عضوية `center_manager` نشطة.
 */
export async function findCentersManagedOnlyBy(userId: number) {
  const database = await requireDb();
  const viaMembership = await database
    .select({ centerId: centerMemberships.centerId })
    .from(centerMemberships)
    .where(
      and(
        eq(centerMemberships.userId, userId),
        eq(centerMemberships.role, "center_manager"),
        eq(centerMemberships.status, "active"),
        isNull(centerMemberships.revokedAt)
      )
    );
  const viaColumn = await database
    .select({ centerId: centers.id })
    .from(centers)
    .where(eq(centers.managerId, userId));
  const candidateIds = Array.from(
    new Set([...viaMembership, ...viaColumn].map(row => row.centerId))
  );
  if (candidateIds.length === 0) return [];

  const active = await database
    .select({ id: centers.id, name: centers.name })
    .from(centers)
    .where(and(inArray(centers.id, candidateIds), isNull(centers.deletedAt)));
  if (active.length === 0) return [];

  const otherManagers = await database
    .select({ centerId: centerMemberships.centerId })
    .from(centerMemberships)
    .innerJoin(users, eq(users.id, centerMemberships.userId))
    .where(
      and(
        inArray(
          centerMemberships.centerId,
          active.map(center => center.id)
        ),
        ne(centerMemberships.userId, userId),
        eq(centerMemberships.role, "center_manager"),
        eq(centerMemberships.status, "active"),
        isNull(centerMemberships.revokedAt),
        isNull(users.deletedAt)
      )
    );
  const covered = new Set(otherManagers.map(row => row.centerId));
  return active.filter(center => !covered.has(center.id));
}

/** ما يمنع الحذف الآن، برسالة عربية تشرح الخطوة المطلوبة. null = الحذف متاح. */
export async function getDeletionBlocker(user: { id: number; role: string }) {
  if (PLATFORM_ADMIN_ROLES.has(user.role)) {
    return "حساب المدير العام لا يُحذف من الواجهة حتى لا تبقى المنصة بلا إدارة. أنشئ مديراً عاماً آخر ثم اطلب منه إيقاف هذا الحساب.";
  }
  const orphaned = await findCentersManagedOnlyBy(user.id);
  if (orphaned.length > 0) {
    const names = orphaned.map(center => `«${center.name}»`).join("، ");
    return `أنت المدير الوحيد لـ ${names}. أضف مديراً آخر للمركز أو احذف المركز أولاً، ثم احذف حسابك.`;
  }
  return null;
}

/**
 * يحذف بيانات الحساب ويجعله مجهول الهوية في معاملة واحدة. لا يتحقق من الصلاحية؛ المستدعي يفعل ذلك.
 * بعده لا يمكن الدخول بالحساب بأي وسيلة: لا بيانات دخول، وopenId عشوائي، وdeletedAt مضبوط، والجلسات باطلة.
 */
export async function eraseAccount(userId: number, now = new Date()) {
  const database = await requireDb();
  await database.transaction(async tx => {
    // بيانات الدخول والهوية
    await tx
      .delete(localCredentials)
      .where(eq(localCredentials.userId, userId));
    await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId));
    await tx
      .delete(passwordSetupTokens)
      .where(eq(passwordSetupTokens.userId, userId));

    // البيانات الشخصية داخل التطبيق
    await tx.delete(quranBookmarks).where(eq(quranBookmarks.userId, userId));
    await tx
      .delete(quranVersePreferences)
      .where(eq(quranVersePreferences.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(aiDailyUsage).where(eq(aiDailyUsage.userId, userId));

    // الوصول إلى المراكز
    await tx
      .delete(centerMemberships)
      .where(eq(centerMemberships.userId, userId));
    await tx
      .delete(permissionGrants)
      .where(eq(permissionGrants.userId, userId));
    await tx.delete(userScopes).where(eq(userScopes.userId, userId));
    await tx
      .delete(parentStudentLinks)
      .where(eq(parentStudentLinks.guardianUserId, userId));

    // سجلات المركز تبقى للمركز، ويُفك ربطها بالحساب فقط.
    await tx
      .update(teachers)
      .set({ userId: null })
      .where(eq(teachers.userId, userId));
    await tx
      .update(students)
      .set({ userId: null })
      .where(eq(students.userId, userId));
    await tx
      .update(students)
      .set({ guardianUserId: null })
      .where(eq(students.guardianUserId, userId));
    await tx
      .update(accessCodes)
      .set({ assignedUserId: null })
      .where(eq(accessCodes.assignedUserId, userId));
    await tx
      .update(accessCodes)
      .set({ guardianUserId: null })
      .where(eq(accessCodes.guardianUserId, userId));

    // بيانات الجهاز في السجلات: يبقى الحدث (للأمان والمساءلة) بلا عنوان IP أو متصفح.
    await tx
      .update(auditLog)
      .set({ ipAddress: null, userAgent: null })
      .where(eq(auditLog.userId, userId));
    await tx
      .update(accessCodeAttempts)
      .set({ ipAddress: null, userAgent: null })
      .where(eq(accessCodeAttempts.attemptedByUserId, userId));

    await tx
      .update(users)
      .set({
        openId: `deleted_${userId}_${randomBytes(8).toString("hex")}`,
        name: DELETED_USER_NAME,
        email: null,
        phone: null,
        avatar: null,
        loginMethod: null,
        role: "user",
        isActive: false,
        accountStatus: "archived",
        accessRevokedAt: now,
        deletedAt: now,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, userId));

    await tx.insert(auditLog).values({
      userId,
      action: "auth.account_deleted",
      entity: "auth",
      entityId: userId,
    });
  });
}

/** يعدّ ما سيُحذف ليعرضه للمستخدم قبل التأكيد. */
async function countPersonalData(userId: number) {
  const database = await requireDb();
  const count = async (
    table:
      typeof quranBookmarks | typeof notifications | typeof centerMemberships,
    column:
      | typeof quranBookmarks.userId
      | typeof notifications.userId
      | typeof centerMemberships.userId
  ) =>
    Number(
      (
        await database
          .select({ n: sql<number>`count(*)` })
          .from(table)
          .where(eq(column, userId))
      )[0]?.n ?? 0
    );
  return {
    bookmarks: await count(quranBookmarks, quranBookmarks.userId),
    notifications: await count(notifications, notifications.userId),
    centers: await count(centerMemberships, centerMemberships.userId),
  };
}

export const accountDeletionRouter = {
  /** ما تعرضه بطاقة «حذف الحساب» في الإعدادات. */
  deletionStatus: protectedProcedure.query(async ({ ctx }) => {
    const database = await requireDb();
    const credential = (
      await database
        .select({ id: localCredentials.id })
        .from(localCredentials)
        .where(eq(localCredentials.userId, ctx.user.id))
        .limit(1)
    )[0];
    return {
      blocker: await getDeletionBlocker(ctx.user),
      requiresPassword: Boolean(credential),
      confirmationPhrase: DELETE_CONFIRMATION_PHRASE,
      counts: await countPersonalData(ctx.user.id),
    };
  }),

  /**
   * يحذف حساب المستخدم الحالي نهائياً. يلزم كتابة عبارة التأكيد، وكلمة المرور إن كان للحساب كلمة مرور
   * (حساب Google فقط يكتفي بالعبارة لأن جلسته مُثبتة بـ Google).
   */
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z.string().trim().max(64),
        password: z.string().max(PASSWORD_MAX_LENGTH).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.confirmation !== DELETE_CONFIRMATION_PHRASE) {
        throw fail(
          "BAD_REQUEST",
          `اكتب «${DELETE_CONFIRMATION_PHRASE}» كما هي لتأكيد الحذف`
        );
      }
      if (!(await consumeRateLimit(`delete-account:${ctx.user.id}`))) {
        throw fail("TOO_MANY_REQUESTS", "محاولات كثيرة، حاول لاحقاً");
      }
      const blocker = await getDeletionBlocker(ctx.user);
      if (blocker) throw fail("PRECONDITION_FAILED", blocker);

      const database = await requireDb();
      const credential = (
        await database
          .select()
          .from(localCredentials)
          .where(eq(localCredentials.userId, ctx.user.id))
          .limit(1)
      )[0];
      if (credential) {
        if (
          !input.password ||
          !(await verifyPassword(input.password, credential.passwordHash))
        ) {
          throw fail("UNAUTHORIZED", "كلمة المرور غير صحيحة");
        }
      }

      await eraseAccount(ctx.user.id);
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      logger.info({ userId: ctx.user.id }, "[Auth] account deleted by owner");
      return { success: true } as const;
    }),
};
