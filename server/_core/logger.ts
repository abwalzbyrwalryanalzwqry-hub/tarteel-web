/**
 * سجلات الخادم: JSON سطراً سطراً (pino) في الإنتاج، تقرؤها `docker compose logs` وأي أداة تجميع.
 *
 * - LOG_LEVEL: trace | debug | info (الافتراضي) | warn | error | silent
 * - لا نسجل أبداً مدخلات الطلبات ولا الكوكيز ولا رؤوس Authorization: فيها كلمات مرور ورموز.
 * - SENTRY_DSN (اختياري): يرسل الأخطاء الداخلية إلى Sentry إن ثُبتت الحزمة `@sentry/node`.
 */
import type { NextFunction, Request, Response } from "express";
import pino from "pino";

export const logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: { service: "tarteel" },
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.inviteCode",
    ],
    censor: "[محجوب]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

type ErrorReporter = (error: unknown, context: Record<string, unknown>) => void;
let reportToSentry: ErrorReporter | null = null;

/** يفعّل Sentry فقط إن ضُبط SENTRY_DSN؛ الحزمة غير مضمنة افتراضياً حتى لا يكبر الخادم بلا حاجة. */
export async function initErrorReporting() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    const moduleName = "@sentry/node";
    const Sentry = await import(/* @vite-ignore */ moduleName);
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
    reportToSentry = (error, context) =>
      Sentry.captureException(error, { extra: context });
    logger.info("error reporting enabled (Sentry)");
  } catch (error) {
    logger.warn(
      { err: error },
      "SENTRY_DSN is set but @sentry/node is not installed; run `pnpm add @sentry/node`"
    );
  }
}

/** يسجل خطأً داخلياً ويرسله إلى Sentry إن كان مفعلاً. */
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {}
) {
  logger.error({ err: error, ...context }, "internal error");
  try {
    reportToSentry?.(error, context);
  } catch {
    /* لا نسمح لأداة المراقبة بإسقاط الطلب. */
  }
}

/** سطر لكل طلب API: الطريقة والمسار والحالة والمدة. لا يسجل المدخلات ولا فحص الصحة. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // نلتقط المسار الآن: Express يعيد كتابة req.path داخل المسارات المركّبة (app.use("/api/trpc")).
  const path = req.path;
  if (!path.startsWith("/api/") || path === "/api/health") return next();
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    // مسار tRPC يحمل أسماء الإجراءات (مثل /api/trpc/students.list) دون المدخلات (تأتي في ?input=).
    logger[level](
      {
        method: req.method,
        path,
        status: res.statusCode,
        ms: Math.round(ms),
      },
      "request"
    );
  });
  next();
}
