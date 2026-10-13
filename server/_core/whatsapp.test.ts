import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildVerificationMessage,
  buildWhatsAppLink,
  extractInboundTextMessages,
  extractVerificationCode,
  generateVerificationCode,
  getWhatsAppConfig,
  isValidWebhookSignature,
} from "./whatsapp";

const env = (extra: Record<string, string> = {}) =>
  ({
    WHATSAPP_BUSINESS_NUMBER: "+967 777 000 111",
    WHATSAPP_APP_SECRET: "s".repeat(32),
    WHATSAPP_VERIFY_TOKEN: "verify-token-123",
    ...extra,
  }) as NodeJS.ProcessEnv;

describe("إعداد واتساب", () => {
  it("يتطلب الرقم الدولي والسر ورمز التحقق، والرد اختياري", () => {
    expect(getWhatsAppConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      getWhatsAppConfig(env({ WHATSAPP_BUSINESS_NUMBER: "777000111" }))
    ).toBeNull();
    expect(getWhatsAppConfig(env({ WHATSAPP_APP_SECRET: "short" }))).toBeNull();
    const config = getWhatsAppConfig(env());
    expect(config?.businessNumber).toBe("967777000111");
    expect(config?.reply).toBeNull();
    expect(
      getWhatsAppConfig(
        env({
          WHATSAPP_ACCESS_TOKEN: "EAAG",
          WHATSAPP_PHONE_NUMBER_ID: "1234567890",
        })
      )?.reply
    ).toEqual({ accessToken: "EAAG", phoneNumberId: "1234567890" });
  });
});

describe("رمز التحقق", () => {
  it("يولّد رموزاً بحروف لا تلتبس", () => {
    for (let i = 0; i < 200; i += 1)
      expect(generateVerificationCode()).toMatch(
        /^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/
      );
  });

  it("يستخرج الرمز من الرسالة الجاهزة أو مكتوباً يدوياً", () => {
    const code = generateVerificationCode();
    expect(
      extractVerificationCode(buildVerificationMessage(code, "signup"))
    ).toBe(code);
    expect(extractVerificationCode(code.replace("-", "").toLowerCase())).toBe(
      code
    );
    expect(extractVerificationCode(`  ${code.replace("-", " ")} `)).toBe(code);
    expect(extractVerificationCode("مرحباً، أريد الاستفسار")).toBeNull();
    expect(extractVerificationCode("ABCD-EFGHJ")).toBeNull();
  });

  it("يقبل الأرقام العربية في الرمز", () => {
    expect(extractVerificationCode("٢٣٤٥-٦٧٨٩")).toBe("2345-6789");
  });

  it("يكتب الغرض في الرسالة ويبني رابط wa.me", () => {
    const message = buildVerificationMessage("2345-6789", "reset");
    expect(message).toContain("لاستعادة كلمة مروري");
    expect(buildWhatsAppLink("967777000111", message)).toBe(
      `https://wa.me/967777000111?text=${encodeURIComponent(message)}`
    );
  });
});

describe("Webhook", () => {
  it("يتحقق من توقيع X-Hub-Signature-256", () => {
    const secret = "s".repeat(32);
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(isValidWebhookSignature(body, signature, secret)).toBe(true);
    expect(isValidWebhookSignature(body, signature, "x".repeat(32))).toBe(
      false
    );
    expect(isValidWebhookSignature(Buffer.from("{}"), signature, secret)).toBe(
      false
    );
    expect(isValidWebhookSignature(body, undefined, secret)).toBe(false);
    expect(isValidWebhookSignature(body, "sha256=zz", secret)).toBe(false);
  });

  it("يستخرج الرسائل النصية فقط", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    id: "a",
                    from: "967777123456",
                    type: "text",
                    text: { body: "2345-6789" },
                  },
                  { id: "b", from: "967777123456", type: "image" },
                ],
                statuses: [{ id: "c", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    expect(extractInboundTextMessages(payload)).toEqual([
      { id: "a", from: "967777123456", text: "2345-6789" },
    ]);
    expect(extractInboundTextMessages({ object: "page" })).toEqual([]);
    expect(extractInboundTextMessages(null)).toEqual([]);
  });
});
