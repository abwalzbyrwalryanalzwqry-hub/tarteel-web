export type ParentMessageTemplateKey = "achievement" | "absence" | "reminder" | "monthly";

export type ParentMessageTemplate = {
  key: ParentMessageTemplateKey;
  title: string;
  description: string;
  content: string;
};

export const PARENT_MESSAGE_TEMPLATES: ParentMessageTemplate[] = [
  {
    key: "achievement",
    title: "رسالة إنجاز",
    description: "إشادة بتقدم الطالب في الحفظ أو المراجعة",
    content: "السلام عليكم، نبارك لكم تقدّم الطالب {{studentName}} في حلقة {{circleName}}. نسأل الله أن يبارك في جهده ويثبته على كتابه.",
  },
  {
    key: "absence",
    title: "تنبيه غياب",
    description: "تذكير ولي الأمر بغياب الطالب عن الحلقة",
    content: "السلام عليكم، نود إشعاركم بغياب الطالب {{studentName}} عن حلقة {{circleName}}. نرجو التكرم بمتابعة حضوره، ونسأل الله له التوفيق.",
  },
  {
    key: "reminder",
    title: "تذكير بالحلقة",
    description: "تذكير لطيف بموعد الحلقة والمتابعة المنزلية",
    content: "السلام عليكم، نذكّركم بمتابعة الطالب {{studentName}} في ورد الحفظ والمراجعة الخاص بحلقة {{circleName}}. شكرًا لتعاونكم.",
  },
  {
    key: "monthly",
    title: "ملخص شهري",
    description: "رسالة موجزة لإحاطة ولي الأمر بالمتابعة الشهرية",
    content: "السلام عليكم، هذا ملخص متابعة الطالب {{studentName}} في حلقة {{circleName}} خلال الفترة {{period}}. يمكنكم مراجعة تفاصيل الإنجاز والحضور من منصة ترتيل.",
  },
];

export function renderParentMessage(template: string, values: Record<string, string | undefined>): string {
  return template.replace(/{{(\w+)}}/g, (_, key: string) => values[key] || "—");
}

export function createWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function createSmsUrl(phone: string, message: string): string {
  return `sms:${phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`;
}
