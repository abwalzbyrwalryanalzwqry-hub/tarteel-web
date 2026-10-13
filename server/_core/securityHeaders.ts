/**
 * ترويسات الأمان لكل الردود (M2): Content-Security-Policy وX-Content-Type-Options وغيرهما.
 *
 * الواجهة لا تحمّل سكربتات أو خطوطاً من نطاقات أخرى، فالسياسة ضيقة:
 * - script-src 'self': لا سكربت مضمن ولا خارجي؛ أي حقن HTML لا ينفّذ شيئاً.
 * - style-src يسمح بـ 'unsafe-inline' لأن React وRadix يضعان أنماطاً في خاصية style.
 * - img-src يسمح بـ https: لأن /storage/ مع محرك s3 يحوّل إلى رابط موقّع على نطاق التخزين.
 * - frame-src وobject-src وconnect-src تسمح بـ blob: لمعاينة تقارير PDF وتنزيلها: مستند blob يرث سياسة الصفحة،
 *   وobject-src 'none' يمنع عارض PDF في Chrome من عرضه داخل الإطار. blob: لا يُنشأ إلا من نفس الأصل.
 *
 *   CSP_MODE=enforce (الافتراضي) | report-only | off
 *   CSP_EXTRA_SOURCES="https://analytics.example.com"  تُضاف إلى script-src وconnect-src (مثل Umami)
 *
 * في التطوير تُعطّل السياسة لأن Vite يحقن سكربتات مضمنة لإعادة التحميل.
 */
import type { NextFunction, Request, Response } from "express";

export function buildContentSecurityPolicy(extraSources: string[] = []) {
  const extra = extraSources.filter(source =>
    /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(source)
  );
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...extra],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "blob:", ...extra],
    "media-src": ["'self'", "blob:", "https:"],
    "frame-src": ["'self'", "blob:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'self'", "blob:"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(
  options: { mode?: string; extraSources?: string; isProduction?: boolean } = {}
) {
  const mode = (options.mode ?? process.env.CSP_MODE ?? "enforce")
    .trim()
    .toLowerCase();
  const extra = (options.extraSources ?? process.env.CSP_EXTRA_SOURCES ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === "production";
  const policy = buildContentSecurityPolicy(extra);
  const cspHeader =
    mode === "report-only"
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    // ردود /storage/ لملفات SVG تضع سياسة أضيق بنفسها لاحقاً فتحل محل هذه.
    if (isProduction && mode !== "off") res.setHeader(cspHeader, policy);
    next();
  };
}
