/**
 * عميل tRPC لقسم المصحف خارج React (المزامنة وصندوق المراجعات). في زِن كانت هذه الوحدات تنادي
 * Supabase مباشرة؛ في ترتيل تنادي خادم ترتيل بعميل tRPC نفسه الذي يستعمله التطبيق (الجلسة بملف تعريف
 * الارتباط، ونسخة الجهاز تمرّ بالخادم المحلي داخل المتصفح). يضبطه MushafApp عند التركيب.
 */
import type { trpc } from "@/lib/trpc";

export type MushafApiClient = ReturnType<typeof trpc.useUtils>["client"];

let client: MushafApiClient | null = null;

export function setMushafApi(next: MushafApiClient | null): void {
  client = next;
}

export function mushafApi(): MushafApiClient {
  if (!client) throw new Error("خادم ترتيل غير متاح بعد");
  return client;
}
