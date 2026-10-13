import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "../_core/env";
import { registerGoogleAuth } from "./google";

const original = { ...ENV };
let base = "";
let close = () => undefined as void;

beforeAll(async () => {
  Object.assign(ENV, { googleClientId: "client-1.apps.googleusercontent.com", googleClientSecret: "secret", publicAppUrl: "https://tarteel.test", cookieSecret: "x".repeat(40) });
  const app = express();
  registerGoogleAuth(app);
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => { server.close(); };
});
afterAll(() => { close(); Object.assign(ENV, original); });

describe("مسارات الدخول بـ Google", () => {
  it("يحوّل إلى Google مع PKCE وstate وعنوان رجوع من PUBLIC_APP_URL، ويضع كوكي الحالة httpOnly", async () => {
    const response = await fetch(`${base}/api/auth/google?invite=TRTL-1234ABCD`, { redirect: "manual", headers: { Host: "evil.test" } });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("redirect_uri")).toBe("https://tarteel.test/api/auth/google/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")?.length).toBeGreaterThan(20);
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("tarteel_google_oauth=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth/google");
  });

  it("رجوع بلا كوكي أو بحالة مختلفة يعود إلى الدخول برمز خطأ ولا يتصل بـ Google", async () => {
    const noCookie = await fetch(`${base}/api/auth/google/callback?state=a&code=b`, { redirect: "manual" });
    expect(noCookie.headers.get("location")).toBe("/login?google_error=state");
    const start = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
    const cookie = start.headers.get("set-cookie")!.split(";")[0];
    const wrongState = await fetch(`${base}/api/auth/google/callback?state=forged&code=b`, { redirect: "manual", headers: { cookie } });
    expect(wrongState.headers.get("location")).toBe("/login?google_error=state");
  });

  it("غير مفعّل: يعود برمز not_configured", async () => {
    Object.assign(ENV, { googleClientSecret: "" });
    const response = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
    expect(response.headers.get("location")).toBe("/login?google_error=not_configured");
    Object.assign(ENV, { googleClientSecret: "secret" });
  });
});
