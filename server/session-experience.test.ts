import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QURAN_SURAHS } from "../shared/types";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("تزامن البيانات وتجربة جلسة المعلم", () => {
  it("يعزل إحصاءات لوحة التحكم وجلساتها بحلقات الحساب عند غياب صلاحية المركز", () => {
    const database = source("server/db.ts");
    const router = source("server/routers.ts");
    expect(database).toContain("getDashboardStatsForCircles");
    expect(database).toContain("getRecentSessionsForCircles");
    expect(router).toContain("getAccessibleDashboardCircleIds");
    expect(router).toContain("return getDashboardStatsForCircles(await getAccessibleDashboardCircleIds(ctx.user))");
  });

  it("يبطل الكاش المشترك بعد عمليات التعديل لتحديث العدادات والقوائم", () => {
    const main = source("client/src/main.tsx");
    const students = source("client/src/pages/Students.tsx");
    const sessions = source("client/src/pages/Sessions.tsx");
    expect(main).toContain("scheduleSharedDataRefresh");
    expect(main).toContain('event.action.type === "success"');
    expect(students).toContain("utils.dashboard.stats.invalidate()");
    expect(sessions).toContain("utils.dashboard.recentSessions.invalidate()");
  });

  it("يوفر رأس الجلسة نوعاً وتاريخاً مزدوجاً وواجهة اختيار آيات ضمن حدود السورة", () => {
    const header = source("client/src/components/SessionHeaderControls.tsx");
    const ayahPicker = source("client/src/components/AyahPicker.tsx");
    const detail = source("client/src/pages/SessionDetail.tsx");
    expect(header).toContain("يومية");
    expect(header).toContain("مخصصة");
    expect(header).toContain("formatDualCalendarDate");
    expect(ayahPicker).toContain("Array.from({ length: max }");
    expect(ayahPicker).toContain("إدخال يدوي");
    expect(detail).toContain("<AyahPicker");
    expect(QURAN_SURAHS).toHaveLength(114);
    expect(QURAN_SURAHS.find((surah) => surah.number === 2)?.ayahs).toBe(286);
  });

  it("يعرض زر رجوع موحداً مع مسار احتياطي للوحة التحكم", () => {
    const layout = source("client/src/components/TarteelLayout.tsx");
    expect(layout).toContain("const goBack");
    expect(layout).toContain('window.history.back()');
    expect(layout).toContain('navigate("/dashboard")');
    expect(layout).toContain("العودة للشاشة السابقة");
  });
});
