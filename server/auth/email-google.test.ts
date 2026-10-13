import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { actionEmail, getEmailConfig, sendEmail } from "../_core/email";
import { GoogleLoginFailure, profileFromIdToken } from "./google";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; vi.restoreAllMocks(); });

describe("مزود البريد", () => {
  it("بلا مفتاح أو بلا EMAIL_FROM يبقى معطلاً", () => {
    expect(getEmailConfig({}).provider).toBeNull();
    expect(getEmailConfig({ RESEND_API_KEY: "re_x" }).provider).toBeNull();
    expect(getEmailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.co" }).provider).toBe("resend");
    expect(getEmailConfig({ BREVO_API_KEY: "xkeysib", EMAIL_FROM: "a@b.co" }).provider).toBe("brevo");
    expect(getEmailConfig({ EMAIL_PROVIDER: "brevo", RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.co" }).provider).toBeNull();
  });

  it("Resend: Bearer وحقول from/to/subject/html/text", async () => {
    Object.assign(process.env, { RESEND_API_KEY: "re_test", EMAIL_FROM: "no-reply@tarteel.test", EMAIL_PROVIDER: "", BREVO_API_KEY: "" });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    expect(await sendEmail({ to: "u@t.test", subject: "س", html: "<p>h</p>", text: "t" }, fetchImpl as unknown as typeof fetch)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init.body))).toEqual({ from: "ترتيل <no-reply@tarteel.test>", to: ["u@t.test"], subject: "س", html: "<p>h</p>", text: "t" });
  });

  it("Brevo: api-key وsender/to/htmlContent/textContent، والرفض يعيد false دون رمي", async () => {
    Object.assign(process.env, { BREVO_API_KEY: "xkeysib-test", EMAIL_FROM: "no-reply@tarteel.test", RESEND_API_KEY: "", EMAIL_PROVIDER: "" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 401 }));
    expect(await sendEmail({ to: "u@t.test", subject: "س", html: "h", text: "t" }, fetchImpl as unknown as typeof fetch)).toBe(false);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");
    expect(JSON.parse(String(init.body))).toEqual({ sender: { email: "no-reply@tarteel.test", name: "ترتيل" }, to: [{ email: "u@t.test" }], subject: "س", htmlContent: "h", textContent: "t" });
  });

  it("القالب يهرّب HTML في الاسم والرابط", () => {
    const message = actionEmail({ to: "u@t.test", subject: "x", greeting: "مرحباً <b>علي</b>", body: "b", actionLabel: "زر", actionUrl: "https://t.test/a?x=1&y=\"2\"", footer: "f" });
    expect(message.html).not.toContain("<b>علي</b>");
    expect(message.html).toContain("&lt;b&gt;");
    expect(message.html).toContain("x=1&amp;y=&quot;2&quot;");
    expect(message.text).toContain("https://t.test/a?x=1&y=\"2\"");
  });
});

describe("رمز Google", () => {
  const sign = (claims: Record<string, unknown>) => new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("k".repeat(32)));
  const base = { iss: "https://accounts.google.com", aud: "client-1", sub: "1234567890", email: "Ali@Example.com", email_verified: true, name: "علي", exp: Math.floor(Date.now() / 1000) + 600 };

  it("يقبل رمزاً صحيحاً ويوحّد البريد", async () => {
    expect(profileFromIdToken(await sign(base), "client-1")).toEqual({ sub: "1234567890", email: "ali@example.com", emailVerified: true, name: "علي" });
  });

  it("يرفض مُصدراً أو جمهوراً آخر أو رمزاً منتهياً", async () => {
    await expect((async () => profileFromIdToken(await sign({ ...base, iss: "https://evil.test" }), "client-1"))()).rejects.toBeInstanceOf(GoogleLoginFailure);
    await expect((async () => profileFromIdToken(await sign({ ...base, aud: "other" }), "client-1"))()).rejects.toBeInstanceOf(GoogleLoginFailure);
    await expect((async () => profileFromIdToken(await sign({ ...base, exp: Math.floor(Date.now() / 1000) - 3600 }), "client-1"))()).rejects.toBeInstanceOf(GoogleLoginFailure);
  });

  it("email_verified غير true يُعد غير مؤكد", async () => {
    expect(profileFromIdToken(await sign({ ...base, email_verified: false }), "client-1").emailVerified).toBe(false);
  });
});
