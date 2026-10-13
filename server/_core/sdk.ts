import { COOKIE_NAME, SESSION_RENEWAL_HEADER, SESSION_RENEW_AFTER_MS, SESSION_TTL_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

/** `sv` = رقم إصدار الجلسة، يجب أن يطابق users.sessionVersion وإلا تُرفض الجلسة. */
export type SessionPayload = { openId: string; appId: string; name: string; sv: number };
export type VerifiedSession = SessionPayload & { issuedAtMs: number };
export type AuthenticatedUser = User;
export type AuthenticationResult = { user: User; session: VerifiedSession; source: "cookie" | "bearer" };

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/** الحساب يعمل فقط إن كان نشطاً وغير موقوف وغير محذوف. */
export function isAccountUsable(user: Pick<User, "isActive" | "accountStatus" | "accessRevokedAt" | "deletedAt">) {
  return Boolean(user.isActive) && user.accountStatus === "active" && !user.accessRevokedAt && !user.deletedAt;
}

/** جلسات ترتيل: JWT موقّع بـ JWT_SECRET في كوكي HttpOnly (أو ترويسة Bearer). */
class SessionService {
  private secret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; sessionVersion?: number } = {},
  ): Promise<string> {
    return this.signSession({ openId, appId: ENV.appId, name: options.name || "", sv: options.sessionVersion ?? 0 }, options);
  }

  async signSession(payload: SessionPayload, options: { expiresInMs?: number } = {}): Promise<string> {
    const expiresInMs = options.expiresInMs ?? SESSION_TTL_MS;
    return new SignJWT({ openId: payload.openId, appId: payload.appId, name: payload.name, sv: payload.sv })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + expiresInMs) / 1000))
      .sign(this.secret());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<VerifiedSession | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.secret(), { algorithms: ["HS256"] });
      const { openId, appId, name, sv, iat } = payload as Record<string, unknown>;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || typeof name !== "string") return null;
      if (appId !== ENV.appId) return null;
      // الجلسات القديمة (قبل إضافة sv و iat) كانت صالحة سنة ولا يمكن إبطالها؛ نرفضها فيعيد المستخدم الدخول مرة واحدة.
      if (typeof sv !== "number" || !Number.isInteger(sv) || typeof iat !== "number") return null;
      return { openId, appId, name, sv, issuedAtMs: iat * 1000 };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /** يكتب كوكي جلسة جديدة مرتبطة بإصدار الجلسة الحالي للمستخدم. */
  async issueSessionCookie(req: Request, res: Response, user: Pick<User, "openId" | "name" | "email" | "sessionVersion">) {
    const token = await this.createSessionToken(user.openId, {
      name: user.name || user.email || "مستخدم",
      sessionVersion: user.sessionVersion ?? 0,
      expiresInMs: SESSION_TTL_MS,
    });
    res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: SESSION_TTL_MS });
    return token;
  }

  /**
   * عملاء Bearer (تطبيق أو سكربت يرسل ترويسة Authorization) لا يستقبلون كوكي،
   * فنعيد لهم الرمز المجدَّد في ترويسة الاستجابة ليحفظه العميل بدل القديم.
   */
  async issueBearerRenewal(res: Response, user: Pick<User, "openId" | "name" | "email" | "sessionVersion">) {
    const token = await this.createSessionToken(user.openId, {
      name: user.name || user.email || "مستخدم",
      sessionVersion: user.sessionVersion ?? 0,
      expiresInMs: SESSION_TTL_MS,
    });
    res.setHeader(SESSION_RENEWAL_HEADER, token);
    return token;
  }

  async authenticate(req: Request): Promise<AuthenticationResult> {
    let source: AuthenticationResult["source"] = "cookie";
    let sessionToken = req.headers.cookie ? parseCookieHeader(req.headers.cookie)[COOKIE_NAME] : undefined;
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
        source = "bearer";
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");
    if (!isAccountUsable(user)) throw ForbiddenError("User is not active");
    if ((user.sessionVersion ?? 0) !== session.sv) throw ForbiddenError("Session revoked");

    await db.touchLastSignedIn(user).catch((error) => console.warn("[Auth] lastSignedIn update failed", String(error)));
    return { user, session, source };
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    return (await this.authenticate(req)).user;
  }

  /** تجديد الكوكي بعد مرور نصف مدتها، فيبقى المستخدم النشط داخلاً ويخرج الخامل بعد 30 يوماً. */
  shouldRenew(session: VerifiedSession, now = Date.now()) {
    return now - session.issuedAtMs >= SESSION_RENEW_AFTER_MS;
  }
}

export const sdk = new SessionService();
