import { describe, expect, it } from "vitest";
import { getNotificationAction } from "../shared/notificationActions";

describe("إجراءات الإشعارات المرتبطة", () => {
  it("يوجه إشعار استرداد كود الدخول إلى إدارة الأكواد", () => {
    expect(getNotificationAction({ relatedType: "access_code_redeemed", relatedId: 7 })).toEqual({ label: "مراجعة أكواد الدخول", href: "/access-management" });
  });

  it("يفتح يوم السجل اليومي عند توفر معرف صالح ولا يخترع إجراء لأنواع لا تملك وجهة", () => {
    expect(getNotificationAction({ relatedType: "daily_record", relatedId: 19 })).toEqual({ label: "فتح السجل اليومي", href: "/daily?record=19" });
    expect(getNotificationAction({ relatedType: "daily_record", relatedId: 0 })).toBeNull();
    expect(getNotificationAction({ relatedType: "attendance", relatedId: 19 })).toBeNull();
  });

  it("يوجّه إشعارات الفترات القديمة إلى السجل اليومي", () => {
    expect(getNotificationAction({ relatedType: "session", relatedId: 19 })).toEqual({ label: "فتح السجل اليومي", href: "/daily" });
  });
});
