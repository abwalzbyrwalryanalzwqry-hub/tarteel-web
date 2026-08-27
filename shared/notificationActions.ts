export type NotificationActionSource = { relatedType?: string | null; relatedId?: number | null };

export type NotificationAction = { label: string; href: string };

/** لا يعرض إجراءً إلا للأنواع التي تملك وجهة تشغيلية ثابتة في التطبيق. */
export function getNotificationAction(notification: NotificationActionSource): NotificationAction | null {
  if (notification.relatedType === "access_code_redeemed") return { label: "مراجعة أكواد الدخول", href: "/access-management" };
  if (notification.relatedType === "access_code") return { label: "فتح لوحة التحكم", href: "/dashboard" };
  if (notification.relatedType === "session" && Number.isInteger(notification.relatedId) && (notification.relatedId ?? 0) > 0) return { label: "فتح الفترة", href: `/periods/${notification.relatedId}` };
  return null;
}
