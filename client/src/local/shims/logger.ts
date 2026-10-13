/** بديل server/_core/logger.ts (pino) في النسخة المحلية: يكتب التحذيرات والأخطاء فقط في وحدة التحكم. */
type LogFn = (objOrMsg?: unknown, msg?: string) => void;
type Logger = {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  child: () => Logger;
  level: string;
};

const noop: LogFn = () => undefined;
const write = (level: "warn" | "error") =>
  ((objOrMsg?: unknown, msg?: string) => {
    if (typeof objOrMsg === "string") console[level](`[Tarteel] ${objOrMsg}`);
    else console[level](`[Tarteel] ${msg ?? ""}`, objOrMsg);
  }) as LogFn;

export const logger: Logger = {
  level: "warn",
  trace: noop,
  debug: noop,
  info: noop,
  warn: write("warn"),
  error: write("error"),
  fatal: write("error"),
  child: () => logger,
};

export async function initErrorReporting() {}

export function reportError(
  error: unknown,
  context: Record<string, unknown> = {}
) {
  console.error("[Tarteel]", error, context);
}

export function requestLogger(_req: unknown, _res: unknown, next: () => void) {
  next();
}
