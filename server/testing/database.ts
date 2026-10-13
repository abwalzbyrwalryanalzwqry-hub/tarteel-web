/**
 * اختبارات تحتاج MySQL حقيقية: تعمل فقط إن ضُبط TEST_DATABASE_URL (في CI عبر خدمة MySQL،
 * ومحلياً بقاعدة تجريبية مطبق عليها `drizzle-kit migrate`). وإلا تُتخطى دون أن تفشل.
 *
 *   TEST_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/tarteel_test pnpm test
 */
import { randomBytes } from "node:crypto";
import { describe } from "vitest";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim() || "";
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

export const describeWithDb = TEST_DATABASE_URL ? describe : describe.skip;

/** لاحقة فريدة لكل تشغيل، حتى لا تتصادم البيانات بين الاختبارات المتوازية. */
export const uniqueSuffix = () => `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
