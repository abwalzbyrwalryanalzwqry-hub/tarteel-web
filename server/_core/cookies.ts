import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

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
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

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
