import type { Request } from "express";

/**
 * عنوان IP الحقيقي للعميل.
 *
 * لا نقرأ أول قيمة في X-Forwarded-For مباشرة: العميل يستطيع وضع أي قيمة فيها،
 * والوكيل العكسي يضيف العنوان الحقيقي في نهايتها. Express يحسب `req.ip`
 * بشكل صحيح من نهاية القائمة حسب إعداد `trust proxy` (TRUST_PROXY_HOPS).
 */
export function getClientIp(req: Pick<Request, "ip" | "socket"> | undefined): string {
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}
