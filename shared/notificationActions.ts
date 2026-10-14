export type NotificationActionSource = { relatedType?: string | null; relatedId?: number | null };

export type NotificationAction = { label: string; href: string };

/** لا يعرض إجراءً إلا للأنواع التي تملك وجهة تشغيلية ثابتة في التطبيق. */
export function getNotificationAction(notification: NotificationActionSource): NotificationAction | null {
  if (notification.relatedType === "access_code_redeemed") return { label: "مراجعة أكواد الدخول", href: "/access-management" };
  if (notification.relatedType === "access_code") return { label: "فتح لوحة التحكم", href: "/dashboard" };
  const id = Number.isInteger(notification.relatedId) && (notification.relatedId ?? 0) > 0 ? notification.relatedId : null;
  if (notification.relatedType === "daily_record" && id) return { label: "فتح السجل اليومي", href: `/daily?record=${id}` };
  // إشعارات الفترات القديمة (قبل السجل اليومي): تفتح السجل اليومي نفسه.
  if (notification.relatedType === "session") return { label: "فتح السجل اليومي", href: "/daily" };
  return null;
}
