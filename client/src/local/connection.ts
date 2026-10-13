/** بديل server/data/connection.ts في النسخة المحلية: قاعدة SQLite داخل التطبيق بدل MySQL. */
import type { drizzle } from "drizzle-orm/mysql2";
import { getLocalDb } from "./database";

// أنواع الخادم مبنية على drizzle/mysql؛ واجهة البناء نفسها في SQLite، والفروق تعالجها طبقة database.ts.
export async function getDb(): Promise<ReturnType<typeof drizzle> | null> {
  return (await getLocalDb()) as unknown as ReturnType<typeof drizzle>;
}
