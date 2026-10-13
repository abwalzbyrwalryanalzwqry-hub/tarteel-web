import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SmsError,
  checkPhoneVerification,
  getSmsConfig,
  startPhoneVerification,
} from "./sms";

const SID = `AC${"a".repeat(32)}`;
const SERVICE = `VA${"b".repeat(32)}`;
const env = {
  TWILIO_ACCOUNT_SID: SID,
  TWILIO_AUTH_TOKEN: "token",
  TWILIO_VERIFY_SERVICE_SID: SERVICE,
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => vi.unstubAllEnvs());
const configure = () =>
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));

describe("getSmsConfig", () => {
  it("يتطلب SID حساب وخدمة بصيغة صحيحة مع رمز أو مفتاح API", () => {
    expect(getSmsConfig({})).toBeNull();
    expect(
      getSmsConfig({ ...env, TWILIO_VERIFY_SERVICE_SID: "VA123" })
    ).toBeNull();
    expect(getSmsConfig({ ...env, TWILIO_AUTH_TOKEN: "" })).toBeNull();
    expect(getSmsConfig(env)).toMatchObject({
      username: SID,
      password: "token",
      serviceSid: SERVICE,
    });
    expect(
      getSmsConfig({
        ...env,
        TWILIO_API_KEY_SID: "SKkey",
        TWILIO_API_KEY_SECRET: "secret",
      })
    ).toMatchObject({ username: "SKkey", password: "secret" });
  });
});

describe("Twilio Verify", () => {
  it("يرسل طلب التحقق بالعربية عبر SMS مع مصادقة Basic", async () => {
    configure();
    const fetchImpl = vi.fn(async () => json(201, { status: "pending" }));
    await startPhoneVerification(
      "+967771234567",
      fetchImpl as unknown as typeof fetch
    );
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://verify.twilio.com/v2/Services/${SERVICE}/Verifications`
    );
    expect(String(init.body)).toBe("To=%2B967771234567&Channel=sms&Locale=ar");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${SID}:token`).toString("base64")}`
    );
  });

  it("يصنف أخطاء Twilio إلى أسباب مفهومة", async () => {
    configure();
    const failWith = (code: number) =>
      startPhoneVerification("+967771234567", (async () =>
        json(400, { code })) as unknown as typeof fetch);
    await expect(failWith(60200)).rejects.toMatchObject({
      reason: "invalid_number",
    });
    await expect(failWith(60203)).rejects.toMatchObject({ reason: "too_many" });
    await expect(failWith(60410)).rejects.toMatchObject({ reason: "blocked" });
    await expect(failWith(99999)).rejects.toMatchObject({
      reason: "unavailable",
    });
    await expect(
      startPhoneVerification("+967771234567", (async () => {
        throw new Error("network");
      }) as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(SmsError);
  });

  it("يقبل الرمز فقط عند approved، ويحوّل الأرقام العربية، ويعامل 404 كرمز منتهٍ", async () => {
    configure();
    const approved = vi.fn(async () => json(200, { status: "approved" }));
    expect(
      await checkPhoneVerification(
        "+967771234567",
        "١٢٣ ٤٥٦",
        approved as unknown as typeof fetch
      )
    ).toBe(true);
    expect(
      String(
        (approved.mock.calls[0] as unknown as [string, RequestInit])[1].body
      )
    ).toBe("To=%2B967771234567&Code=123456");
    expect(
      await checkPhoneVerification("+967771234567", "123456", (async () =>
        json(200, { status: "pending" })) as unknown as typeof fetch)
    ).toBe(false);
    expect(
      await checkPhoneVerification("+967771234567", "123456", (async () =>
        json(404, { code: 20404 })) as unknown as typeof fetch)
    ).toBe(false);
    const never = vi.fn();
    expect(
      await checkPhoneVerification(
        "+967771234567",
        "abc",
        never as unknown as typeof fetch
      )
    ).toBe(false);
    expect(never).not.toHaveBeenCalled();
  });

  it("بلا إعداد يرمي unavailable دون أي طلب", async () => {
    const fetchImpl = vi.fn();
    await expect(
      startPhoneVerification(
        "+967771234567",
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toMatchObject({ reason: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
