import { describe, expect, it } from "vitest";
import { filterAuditLogs, filterNotifications, toCsv } from "../shared/activityFilters";

const now = new Date("2026-08-24T12:00:00.000Z").getTime();

describe("فلاتر الأنشطة", () => {
  it("يبحث في الإشعارات ويطبق حالة القراءة والفترة", () => {
    const result = filterNotifications([
      { title: "حضور", message: "تم تسجيل الحضور", isRead: false, createdAt: new Date(now - 60_000) },
      { title: "تقرير", message: "ملخص أسبوعي", isRead: true, createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000) },
    ], { search: "الحضور", readFilter: "unread", dateRange: "today", now });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("حضور");
  });

  it("يطبق سجل التدقيق فلاتر العملية والتاريخ ويهرب CSV", () => {
    const result = filterAuditLogs([
      { action: "create", entity: "students", entityId: 8, createdAt: new Date(now - 60_000) },
      { action: "delete", entity: "teachers", entityId: 3, createdAt: new Date(now - 31 * 24 * 60 * 60 * 1000) },
    ], { search: "students", actionFilter: "create", dateRange: "week", now });
    expect(result).toHaveLength(1);
    expect(toCsv([["الاسم", "وصف \"خاص\""]])).toContain('"وصف ""خاص"""');
  });
});
