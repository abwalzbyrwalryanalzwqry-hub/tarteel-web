import { drizzle } from "drizzle-orm/mysql2";
import { logger } from "../_core/logger";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn({ err: error }, "[Database] failed to connect");
      _db = null;
    }
  }
  return _db;
}
