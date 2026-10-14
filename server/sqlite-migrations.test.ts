/**
 * نسخة الجهاز (sql.js): ترحيلات drizzle-sqlite كلها تُطبَّق بالترتيب على قاعدة فارغة كما يفعل
 * client/src/local/database.ts، فتنتج جداول السجل اليومي وتُزال جداول الفترات والجلسات والتقارير.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

const dir = path.resolve(import.meta.dirname, "../drizzle-sqlite");

describe("ترحيلات نسخة الجهاز", () => {
  it("تُطبَّق كلها وتنتج جداول السجل اليومي دون جداول الفترات القديمة", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    for (const file of readdirSync(dir)
      .filter(f => f.endsWith(".sql"))
      .sort()) {
      const statements = readFileSync(path.join(dir, file), "utf8")
        .split("--> statement-breakpoint")
        .map(part => part.trim())
        .filter(Boolean);
      for (const statement of statements) db.run(statement);
    }
    const tables = new Set(
      (
        db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]
          ?.values ?? []
      ).map(r => String(r[0]))
    );
    for (const t of ["daily_records", "daily_entries", "daily_record_trash"])
      expect(tables).toContain(t);
    for (const t of [
      "sessions",
      "attendance",
      "memorization",
      "revision",
      "evaluation",
      "circle_periods",
      "reporting_goals",
    ])
      expect(tables).not.toContain(t);
    db.close();
  });
});
