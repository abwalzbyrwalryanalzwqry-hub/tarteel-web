import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OAUTH_LOGIN_LOCK_MS, decodeOAuthState, encodeOAuthState, isOAuthLoginAttemptLocked } from "../shared/const";

describe("حماية حالة OAuth على الهاتف", () => {
  it("يربط حالة OAuth المشفرة بالـ nonce نفسه", () => {
    const state = encodeOAuthState({ redirectUri: "https://tarteel.example/api/oauth/callback", nonce: "nonce-1" });
    expect(decodeOAuthState(state)).toEqual({ redirectUri: "https://tarteel.example/api/oauth/callback", nonce: "nonce-1" });
  });

  it("يمنع بدء محاولة ثانية قصيرة من الكتابة فوق nonce المحفوظة", () => {
    const now = 1_000_000;
    expect(isOAuthLoginAttemptLocked(String(now), now + 1)).toBe(true);
    expect(isOAuthLoginAttemptLocked(String(now), now + OAUTH_LOGIN_LOCK_MS)).toBe(false);
    expect(isOAuthLoginAttemptLocked("invalid", now)).toBe(false);
  });

  it("يعيد فشل nonce إلى شاشة دخول آمنة بدلاً من إخراج JSON خام", () => {
    const oauth = readFileSync(path.join(process.cwd(), "server/_core/oauth.ts"), "utf8");
    const client = readFileSync(path.join(process.cwd(), "client/src/main.tsx"), "utf8");
    const login = readFileSync(path.join(process.cwd(), "client/src/pages/LoginPage.tsx"), "utf8");
    expect(oauth).toContain('res.redirect(302, "/login?authError=oauth_state")');
    expect(oauth).toContain("res.clearCookie(OAUTH_STATE_COOKIE");
    expect(client).toContain('window.location.replace("/login")');
    expect(client).not.toContain("startLogin();");
    expect(login).toContain("clearPendingOAuthLoginAttempt()");
    expect(login).toContain("انتهت محاولة الدخول السابقة");
  });

  it("يعرض إرشاد وصول آمن ولا يقدم Google كإجراء دخول فعلي قبل ربطه", () => {
    const login = readFileSync(path.join(process.cwd(), "client/src/pages/LoginPage.tsx"), "utf8");
    const redeem = readFileSync(path.join(process.cwd(), "client/src/pages/RedeemAccessCode.tsx"), "utf8");
    const support = readFileSync(path.join(process.cwd(), "client/src/components/AccessHelpPanel.tsx"), "utf8");
    expect(login).toContain("الدخول الآمن إلى ترتيل");
    expect(login).toContain("التسجيل بحساب Google — غير مفعّل بعد");
    expect(login).toContain("disabled");
    expect(redeem).toContain("AccessHelpPanel");
    expect(support).toContain("دليل الوصول الآمن");
    expect(support).toContain("لا تشارك كودك أو كلمة مرورك");
  });
});
