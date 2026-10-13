/**
 * عدّادات حدود الاستخدام: حد المحاولات لكل مفتاح، وحصة المساعد الذكي اليومية لكل مستخدم.
 *
 * تُحفظ في MySQL فتبقى بعد إعادة تشغيل الخادم وتعمل مع أكثر من نسخة منه.
 * إن لم تتوفر قاعدة بيانات (الاختبارات، أو التطوير بلا DATABASE_URL) أو فشل الاستعلام،
 * نرجع إلى عدّاد في الذاكرة بدل أن نرفض كل الطلبات أو نسمح بها كلها.
 */
import { lt, sql } from "drizzle-orm";
import { aiDailyUsage, rateLimitBuckets } from "../../drizzle/schema";
import { getDb } from "./connection";
import { logger } from "../_core/logger";
import { isSqliteDialect } from "./dialect";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

// ── الذاكرة (احتياطي) ──
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
const memoryAi = new Map<string, number>();

function memoryHit(key: string, windowMs: number, now: number) {
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    if (memoryBuckets.size > 10_000) memoryBuckets.forEach((value, k) => { if (value.resetAt <= now) memoryBuckets.delete(k); });
    return 1;
  }
  bucket.count += 1;
  return bucket.count;
}

/** مفاتيح طويلة (مثل IPv6 مع بادئة) تُقص إلى طول المفتاح الأساسي في الجدول. */
const bucketKey = (key: string) => key.slice(0, 191);

/**
 * عدّاد ذري في جملة واحدة: نضع القيمة الجديدة في LAST_INSERT_ID(expr)، فيعيدها MySQL في
 * insertId لنفس الجملة. بهذا لا يقرأ طلب متزامن قيمة طلب آخر (القراءة بعد الكتابة بجملة
 * مستقلة كانت ترفض طلبات مشروعة عند التزامن لأنها تقرأ مجموع الكل).
 * affectedRows = 1 يعني صفاً جديداً (العدّاد 1)، و2 يعني تحديث صف موجود.
 */
function counterFromResult(result: unknown) {
  const header = (Array.isArray(result) ? result[0] : result) as { affectedRows?: number; insertId?: number };
  if (header?.affectedRows === 1) return 1;
  return Number(header?.insertId ?? 1);
}

async function dbHit(db: Db, key: string, windowMs: number, now: number) {
  const current = new Date(now);
  const resetAt = new Date(now + windowMs);
  // النافذة المنتهية تبدأ من جديد بعدّاد 1. MySQL يطبق التعيينات بالترتيب،
  // وشرط resetAt الثاني يقرأ القيمة القديمة لأن تعيين count لا يغيّرها.
  const result = await db.insert(rateLimitBuckets).values({ bucketKey: key, count: 1, resetAt }).onDuplicateKeyUpdate({
    set: {
      count: sql`LAST_INSERT_ID(IF(${rateLimitBuckets.resetAt} <= ${current}, 1, ${rateLimitBuckets.count} + 1))`,
      resetAt: sql`IF(${rateLimitBuckets.resetAt} <= ${current}, ${resetAt}, ${rateLimitBuckets.resetAt})`,
    },
  });
  // تنظيف عرضي للنوافذ المنتهية منذ يوم (نحو مرة كل 200 طلب).
  if (Math.random() < 0.005) {
    db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.resetAt, new Date(now - 24 * 3600_000))).catch(() => undefined);
  }
  return counterFromResult(result);
}

/** يسجل محاولة ويعيد true إن بقيت ضمن الحد. */
export async function hitRateLimit(key: string, options: { max: number; windowMs: number; now?: number }): Promise<boolean> {
  const now = options.now ?? Date.now();
  const k = bucketKey(key);
  // نسخة الجهاز المحلية (SQLite): مستخدم واحد في كل لحظة، والعدّاد في الذاكرة يكفي.
  const db = isSqliteDialect() ? null : await getDb();
  if (db) {
    try {
      return (await dbHit(db, k, options.windowMs, now)) <= options.max;
    } catch (error) {
      logger.warn({ err: error }, "[RateLimit] database unavailable, using memory");
    }
  }
  return memoryHit(k, options.windowMs, now) <= options.max;
}

/** يوم الحصة بتوقيت UTC (YYYY-MM-DD). */
export const usageDay = (now: Date) => now.toISOString().slice(0, 10);

/** يستهلك رسالة من حصة اليوم؛ يعيد false إن تجاوز المستخدم الحد. */
export async function consumeDailyQuota(userId: number, limit: number, now = new Date()): Promise<boolean> {
  if (limit <= 0) return false;
  const day = usageDay(now);
  const db = isSqliteDialect() ? null : await getDb();
  if (db) {
    try {
      const result = await db.insert(aiDailyUsage).values({ userId, day, count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`LAST_INSERT_ID(${aiDailyUsage.count} + 1)` } });
      if (Math.random() < 0.005) {
        db.delete(aiDailyUsage).where(lt(aiDailyUsage.day, usageDay(new Date(now.getTime() - 7 * 24 * 3600_000)))).catch(() => undefined);
      }
      return counterFromResult(result) <= limit;
    } catch (error) {
      logger.warn({ err: error }, "[AiQuota] database unavailable, using memory");
    }
  }
  const key = `${userId}:${day}`;
  const count = (memoryAi.get(key) ?? 0) + 1;
  memoryAi.set(key, count);
  if (memoryAi.size > 50_000) memoryAi.forEach((_, k) => { if (!k.endsWith(`:${day}`)) memoryAi.delete(k); });
  return count <= limit;
}

export function resetUsageLimitsMemoryForTests() {
  memoryBuckets.clear();
  memoryAi.clear();
}
