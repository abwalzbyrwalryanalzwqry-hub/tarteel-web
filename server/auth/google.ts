/**
 * الدخول بحساب Google (OpenID Connect، تدفق Authorization Code مع PKCE).
 *
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / PUBLIC_APP_URL
 *   عنوان الرجوع المسجّل في Google Cloud: {PUBLIC_APP_URL}/api/auth/google/callback
 *
 * الربط:
 * 1. حساب Google مربوط سابقاً (بالمعرّف الثابت sub) ← دخول مباشر.
 * 2. بريد Google مؤكد (email_verified) ويطابق حساباً موجوداً ← يُربط به. بلا تأكيد لا نربط أبداً،
 *    وإلا استطاع من ينشئ حساب Google ببريد غيره الاستيلاء على حسابه في ترتيل.
 * 3. لا حساب ← ينشأ فقط إن كان التسجيل مفتوحاً أو جاء برمز دعوة صالح (نفس قواعد التسجيل بالبريد).
 */
import { randomBytes, createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify, decodeJwt } from "jose";
import { parse as parseCookieHeader } from "cookie";
import {
  localCredentials,
  oauthAccounts,
  users,
  type User,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { isSecureRequest } from "../_core/cookies";
import { getClientIp } from "../_core/request";
import { isAccountUsable, sdk } from "../_core/sdk";
import * as db from "../db";
import {
  classifyInviteCode,
  discardNewAccount,
  isInviteUsable,
  redeemSignupInvite,
} from "./inviteSignup";
import { consumeRateLimit, normalizeEmail } from "./password";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "tarteel_google_oauth";
const STATE_TTL_SECONDS = 10 * 60;
const GOOGLE_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

export const isGoogleConfigured = () =>
  Boolean(ENV.googleClientId && ENV.googleClientSecret && ENV.publicAppUrl);
export const googleRedirectUri = () =>
  `${ENV.publicAppUrl}/api/auth/google/callback`;

const base64url = (buffer: Buffer) => buffer.toString("base64url");
const secretKey = () => new TextEncoder().encode(ENV.cookieSecret);

export type GoogleProfile = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

/** رموز الأخطاء التي تعرضها صفحة الدخول (/login?google_error=…). */
export type GoogleLoginError =
  | "not_configured"
  | "state"
  | "exchange"
  | "unverified_email"
  | "signup_closed"
  | "invite_invalid"
  | "inactive"
  | "rate_limited";

export class GoogleLoginFailure extends Error {
  constructor(
    readonly code: GoogleLoginError,
    message?: string
  ) {
    super(message ?? code);
  }
}

/** يتحقق من مطالبات id_token. الرمز وصل مباشرة من Google عبر TLS بسرّ العميل، فيكفي فحص المطالبات (OIDC Core 3.1.3.7). */
export function profileFromIdToken(
  idToken: string,
  clientId: string,
  now = Date.now()
): GoogleProfile {
  const claims = decodeJwt(idToken);
  if (!claims.iss || !GOOGLE_ISSUERS.has(String(claims.iss)))
    throw new GoogleLoginFailure("exchange", "issuer");
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId))
    throw new GoogleLoginFailure("exchange", "audience");
  if (!claims.exp || claims.exp * 1000 < now - 60_000)
    throw new GoogleLoginFailure("exchange", "expired");
  if (!claims.sub) throw new GoogleLoginFailure("exchange", "sub");
  const email =
    typeof claims.email === "string" ? normalizeEmail(claims.email) : null;
  return {
    sub: String(claims.sub),
    email,
    emailVerified:
      claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : null,
  };
}

async function requireDb() {
  const database = await db.getDb();
  if (!database) throw new Error("database unavailable");
  return database;
}

async function audit(
  userId: number,
  action: string,
  req: Request,
  data?: Record<string, unknown>
) {
  try {
    await db.createAuditLog({
      userId,
      action,
      entity: "auth",
      entityId: userId,
      newData: data ? JSON.stringify(data) : null,
      ipAddress: getClientIp(req).slice(0, 64),
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 512) || null,
    });
  } catch (error) {
    console.warn("[Google] audit failed", String(error));
  }
}

/** يجد مستخدم ترتيل لحساب Google أو ينشئه، وفق قواعد الربط أعلاه. */
export async function resolveGoogleUser(
  profile: GoogleProfile,
  options: {
    inviteCode?: string | null;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<{ user: User; created: boolean; linked: boolean }> {
  const database = await requireDb();
  const now = new Date();

  const [account] = await database
    .select()
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, "google"),
        eq(oauthAccounts.providerUserId, profile.sub)
      )
    )
    .limit(1);
  if (account) {
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, account.userId))
      .limit(1);
    if (!user || !isAccountUsable(user))
      throw new GoogleLoginFailure("inactive");
    await database
      .update(oauthAccounts)
      .set({ lastUsedAt: now, email: profile.email })
      .where(eq(oauthAccounts.id, account.id));
    return { user, created: false, linked: false };
  }

  if (!profile.email || !profile.emailVerified)
    throw new GoogleLoginFailure("unverified_email");
  const email = profile.email;

  const [credential] = await database
    .select()
    .from(localCredentials)
    .where(eq(localCredentials.email, email))
    .limit(1);
  const existingUserId =
    credential?.userId ??
    (
      await database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), isNull(users.deletedAt)))
        .limit(1)
    )[0]?.id;
  if (existingUserId) {
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, existingUserId))
      .limit(1);
    if (!user || !isAccountUsable(user))
      throw new GoogleLoginFailure("inactive");
    await database
      .insert(oauthAccounts)
      .values({
        provider: "google",
        providerUserId: profile.sub,
        userId: user.id,
        email,
        lastUsedAt: now,
      });
    // Google أكد أن البريد لصاحبه.
    if (credential && !credential.emailVerifiedAt)
      await database
        .update(localCredentials)
        .set({ emailVerifiedAt: now })
        .where(eq(localCredentials.id, credential.id));
    return { user, created: false, linked: true };
  }

  const invite = options.inviteCode
    ? classifyInviteCode(options.inviteCode)
    : null;
  if (options.inviteCode && !invite)
    throw new GoogleLoginFailure("invite_invalid");
  if (!ENV.allowSignup && !invite)
    throw new GoogleLoginFailure("signup_closed");
  if (invite && !(await isInviteUsable(invite)))
    throw new GoogleLoginFailure("invite_invalid");

  const openId = `oauth_${randomBytes(12).toString("hex")}`;
  await db.upsertUser({
    openId,
    name: profile.name?.trim() || email.split("@")[0],
    email,
    loginMethod: "google",
    lastSignedIn: now,
  });
  const created = await db.getUserByOpenId(openId);
  if (!created) throw new Error("user creation failed");
  await database
    .insert(oauthAccounts)
    .values({
      provider: "google",
      providerUserId: profile.sub,
      userId: created.id,
      email,
      lastUsedAt: now,
    });
  if (invite) {
    try {
      await redeemSignupInvite(invite, created.id, {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      });
    } catch {
      await database
        .delete(oauthAccounts)
        .where(eq(oauthAccounts.userId, created.id));
      await discardNewAccount(created.id);
      throw new GoogleLoginFailure("invite_invalid");
    }
  }
  const [fresh] = await database
    .select()
    .from(users)
    .where(eq(users.id, created.id))
    .limit(1);
  return { user: fresh ?? created, created: true, linked: false };
}

function stateCookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(req),
    path: "/api/auth/google",
    maxAge: STATE_TTL_SECONDS * 1000,
  };
}

const redirectToLogin = (res: Response, code: GoogleLoginError) =>
  res.redirect(302, `/login?google_error=${code}`);

export function registerGoogleAuth(app: Express) {
  app.get("/api/auth/google", async (req, res) => {
    if (!isGoogleConfigured() || !ENV.cookieSecret)
      return redirectToLogin(res, "not_configured");
    const state = base64url(randomBytes(24));
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash("sha256").update(verifier).digest());
    const invite =
      typeof req.query.invite === "string"
        ? req.query.invite.slice(0, 128)
        : "";
    const cookie = await new SignJWT({ state, verifier, invite })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${STATE_TTL_SECONDS}s`)
      .sign(secretKey());
    res.cookie(STATE_COOKIE, cookie, stateCookieOptions(req));
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: googleRedirectUri(),
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    res.redirect(302, url.toString());
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { maxAge: _maxAge, ...clearOptions } = stateCookieOptions(req);
    res.clearCookie(STATE_COOKIE, clearOptions);
    try {
      if (!isGoogleConfigured()) throw new GoogleLoginFailure("not_configured");
      if (!(await consumeRateLimit(`google:${getClientIp(req)}`)))
        throw new GoogleLoginFailure("rate_limited");
      const raw = parseCookieHeader(req.headers.cookie ?? "")[STATE_COOKIE];
      if (
        !raw ||
        typeof req.query.state !== "string" ||
        typeof req.query.code !== "string"
      )
        throw new GoogleLoginFailure("state");
      let saved: { state?: string; verifier?: string; invite?: string };
      try {
        saved = (await jwtVerify(raw, secretKey(), { algorithms: ["HS256"] }))
          .payload as typeof saved;
      } catch {
        throw new GoogleLoginFailure("state");
      }
      if (!saved.state || saved.state !== req.query.state || !saved.verifier)
        throw new GoogleLoginFailure("state");

      const tokenResponse = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: googleRedirectUri(),
          grant_type: "authorization_code",
          code_verifier: saved.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenResponse.ok)
        throw new GoogleLoginFailure(
          "exchange",
          `token ${tokenResponse.status}`
        );
      const tokens = (await tokenResponse.json()) as { id_token?: string };
      if (!tokens.id_token)
        throw new GoogleLoginFailure("exchange", "no id_token");
      const profile = profileFromIdToken(tokens.id_token, ENV.googleClientId);

      const { user, created, linked } = await resolveGoogleUser(profile, {
        inviteCode: saved.invite || null,
        ipAddress: getClientIp(req),
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 512),
      });
      await sdk.issueSessionCookie(req, res, user);
      await audit(
        user.id,
        created
          ? "auth.google_register"
          : linked
            ? "auth.google_linked"
            : "auth.google_login",
        req
      );
      res.redirect(302, "/login");
    } catch (error) {
      const code =
        error instanceof GoogleLoginFailure ? error.code : "exchange";
      if (!(error instanceof GoogleLoginFailure) || code === "exchange")
        console.warn("[Google] login failed", String(error));
      redirectToLogin(res, code);
    }
  });
}
