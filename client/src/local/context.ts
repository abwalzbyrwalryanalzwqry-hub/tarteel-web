/**
 * سياق tRPC داخل التطبيق: طلب/استجابة وهميان بدل Express.
 * كوكي الجلسة (JWT نفسه الذي يصدره الخادم) يُحفظ في localStorage، فيبقى المستخدم داخلاً بعد إغلاق التطبيق
 * ويعمل الخروج وتبديل الحسابات على الجهاز نفسه كما في المنصة.
 */
import { COOKIE_NAME } from "@shared/const";
import type { TrpcContext } from "../../../server/_core/context";

export const SESSION_KEY = "tarteel.local.session";
export const ROLE_SIMULATION_HEADER = "x-tarteel-role-simulation";

function readToken() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return memoryToken;
  }
}

let memoryToken: string | null = null;
/** خروج كل الحسابات من الجهاز (بعد استعادة نسخة احتياطية مثلاً). */
export function clearLocalSession() {
  writeToken(null);
}

function writeToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // يبقى في الذاكرة فقط.
  }
}

export function hasLocalSession() {
  return Boolean(readToken());
}

export function buildLocalRequest(extraHeaders: Record<string, string> = {}) {
  const token = readToken();
  const headers: Record<string, string> = {
    "user-agent":
      typeof navigator === "undefined"
        ? "TarteelLocal"
        : `${navigator.userAgent} TarteelLocal`,
    host: typeof location === "undefined" ? "localhost" : location.host,
    ...extraHeaders,
  };
  if (token) headers.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
  return {
    headers,
    ip: "127.0.0.1",
    protocol: "https",
    hostname: "localhost",
    socket: { remoteAddress: "127.0.0.1" },
    get(name: string) {
      return headers[name.toLowerCase()];
    },
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

export function buildLocalResponse() {
  const res = {
    statusCode: 200,
    cookie(name: string, value: string) {
      if (name === COOKIE_NAME) writeToken(value);
      return res;
    },
    clearCookie(name: string) {
      if (name === COOKIE_NAME) writeToken(null);
      return res;
    },
    setHeader() {
      return res;
    },
    getHeader() {
      return undefined;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
  };
  return res;
}

export async function createLocalContext(
  extraHeaders: Record<string, string> = {}
): Promise<TrpcContext> {
  const { createContext } = await import("../../../server/_core/context");
  const req = buildLocalRequest(extraHeaders);
  const res = buildLocalResponse();
  return createContext({ req, res, info: {} } as unknown as Parameters<
    typeof createContext
  >[0]);
}
