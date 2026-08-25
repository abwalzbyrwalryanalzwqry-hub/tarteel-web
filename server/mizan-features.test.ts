import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QURAN_SURAHS } from "../shared/types";

const root = process.cwd();

describe("منظومة الميزان", () => {
  it("يحفظ قوالب الفترات التاريخية ويجعل الفترات الفعلية من سجلات الجلسات", () => {
    const schema = readFileSync(path.join(root, "drizzle/schema.ts"), "utf8");
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    expect(schema).toContain('mysqlTable("circle_periods"');
    expect(router).toContain("circlePeriods: router");
    expect(router).toContain("monthlyRecord");
    expect(router).toContain("createSession");
    expect(router).toContain("sessions: router");
  });

  it("يحتفظ بحدود آيات السور ويطبق نهايات السور في سجلات الإنجاز", () => {
    const router = readFileSync(path.join(root, "server/routers.ts"), "utf8");
    const schema = readFileSync(path.join(root, "drizzle/schema.ts"), "utf8");
    expect(QURAN_SURAHS).toHaveLength(114);
    expect(QURAN_SURAHS.find((surah) => surah.number === 1)?.ayahs).toBe(7);
    expect(QURAN_SURAHS.find((surah) => surah.number === 2)?.ayahs).toBe(286);
    expect(schema).toContain('toSurahNumber: int("toSurahNumber")');
    expect(router).toContain("assertQuranRange");
  });

  it("يربط لوحة الحلقة وملف الطالب بمسارات مستقلة داخل ترتيل", () => {
    const app = readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    const circlePage = readFileSync(path.join(root, "client/src/pages/CircleDetail.tsx"), "utf8");
    const studentPage = readFileSync(path.join(root, "client/src/pages/StudentProfile.tsx"), "utf8");
    expect(app).toContain('path="/circles/:id"');
    expect(app).toContain('path="/students/:id"');
    expect(circlePage).toContain("فترات الحَلَقة");
    expect(circlePage).toContain("كل فترة هي سجل عمل مستقل");
    expect(studentPage).toContain("السجل الزمني");
  });
});
