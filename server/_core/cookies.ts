import type { CookieOptions, Request } from "express";

/**
 * هل وصل الطلب عبر HTTPS؟
 *
 * لا نقرأ X-Forwarded-Proto مباشرة: العميل يستطيع إرسالها بنفسه. `req.protocol`
 * في Express يأخذ بها فقط إن جاء الطلب من وكيل موثوق حسب `trust proxy`
 * (TRUST_PROXY_HOPS)، وهو الإعداد نفسه الذي يحمي حد المحاولات من تزوير IP.
 */
export function isSecureRequest(req: Pick<Request, "protocol">) {
  return req.protocol === "https";
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // Lax: الكوكي لا يُرسل مع طلبات POST القادمة من مواقع أخرى (حماية من CSRF).
  // تطبيق أندرويد يفتح المنصة نفسها داخل WebView فالكوكي فيه من الطرف الأول ولا يحتاج None.
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  };
}
