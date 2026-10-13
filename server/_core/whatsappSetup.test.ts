import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  checkEnv,
  checkGraph,
  checkWebhook,
  generateVerifyToken,
  subscribeApp,
} from "./whatsappSetup";
import { registerWhatsAppWebhook } from "./whatsappWebhook";

const env = {
  WHATSAPP_BUSINESS_NUMBER: "+967 700 000 001",
  WHATSAPP_APP_SECRET: "0123456789abcdef0123456789abcdef",
  WHATSAPP_VERIFY_TOKEN: "verify-token-123",
  PUBLIC_APP_URL: "https://tarteel.ye",
} as NodeJS.ProcessEnv;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("فحص متغيرات البيئة", () => {
  it("يقبل الإعداد الصحيح ويشرح الناقص", () => {
    expect(checkEnv(env).every(r => r.ok)).toBe(true);
    const bad = checkEnv({
      WHATSAPP_BUSINESS_NUMBER: "777",
      PUBLIC_APP_URL: "http://tarteel.example.org",
    } as NodeJS.ProcessEnv);
    expect(bad.filter(r => !r.ok).map(r => r.label)).toEqual([
      "WHATSAPP_BUSINESS_NUMBER",
      "WHATSAPP_APP_SECRET",
      "WHATSAPP_VERIFY_TOKEN",
      "PUBLIC_APP_URL",
    ]);
    expect(generateVerifyToken().length).toBeGreaterThanOrEqual(32);
  });
});

describe("فحص Webhook على خادم حقيقي", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    for (const [key, value] of Object.entries(env))
      vi.stubEnv(key, value as string);
    const app = express();
    registerWhatsAppWebhook(app);
    await new Promise<void>(resolve => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    return new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("ينجح بالإعداد المطابق", async () => {
    const results = await checkWebhook(base, env);
    expect(results.map(r => [r.label, r.ok])).toEqual([
      ["مصافحة Webhook (GET)", true],
      ["رسالة موقعة (POST)", true],
      ["رفض رسالة بلا توقيع", true],
    ]);
  });

  it("يكشف رمز تحقق أو سراً لا يطابق الخادم", async () => {
    const results = await checkWebhook(base, {
      ...env,
      WHATSAPP_VERIFY_TOKEN: "other-token-1",
      WHATSAPP_APP_SECRET: "f".repeat(32),
    });
    expect(results[0]).toMatchObject({ ok: false });
    expect(results[0].detail).toContain("403");
    expect(results[1].detail).toContain("401");
  });

  it("يشرح تعذر الوصول", async () => {
    const results = await checkWebhook("http://127.0.0.1:1", env);
    expect(results).toHaveLength(1);
    expect(results[0].detail).toContain("تعذر الوصول");
  });
});

describe("فحوص Graph API", () => {
  const graphEnv = {
    ...env,
    WHATSAPP_ACCESS_TOKEN: "EAAG",
    WHATSAPP_PHONE_NUMBER_ID: "1234567890",
    WHATSAPP_WABA_ID: "555",
    WHATSAPP_APP_ID: "999",
  } as NodeJS.ProcessEnv;

  it("يتخطى بلا رمز وصول", async () => {
    const results = await checkGraph(env);
    expect(results[0].detail).toContain("WHATSAPP_ACCESS_TOKEN");
  });

  it("يطابق الرقم ويكشف غياب اشتراك التطبيق", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("subscribed_apps")
        ? json({
            data: [
              {
                whatsapp_business_api_data: {
                  id: "1",
                  name: "WA DevX Webhook Events 1P App",
                },
              },
            ],
          })
        : json({
            display_phone_number: "+967 70 000 0001",
            verified_name: "ترتيل",
            quality_rating: "GREEN",
            platform_type: "CLOUD_API",
          })
    );
    const results = await checkGraph(
      graphEnv,
      fetchMock as unknown as typeof fetch
    );
    expect(results[0]).toMatchObject({ ok: true, label: "رقم الأعمال" });
    expect(results[1]).toMatchObject({ ok: false });
    expect(results[1].detail).toContain("subscribe");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer EAAG" },
    });
  });

  it("يكشف رقماً لا يطابق WHATSAPP_BUSINESS_NUMBER", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("subscribed_apps")
        ? json({ data: [{ whatsapp_business_api_data: { id: "999" } }] })
        : json({
            display_phone_number: "+1 555 0100",
            platform_type: "CLOUD_API",
          })
    );
    const results = await checkGraph(
      graphEnv,
      fetchMock as unknown as typeof fetch
    );
    expect(results[0]).toMatchObject({ ok: false });
    expect(results[1]).toMatchObject({ ok: true });
  });

  it("الاشتراك يرسل POST إلى subscribed_apps", async () => {
    const fetchMock = vi.fn(async () => json({ success: true }));
    const result = await subscribeApp(
      graphEnv,
      fetchMock as unknown as typeof fetch
    );
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v23.0/555/subscribed_apps",
      expect.objectContaining({ method: "POST" })
    );
    const denied = await subscribeApp(graphEnv, (async () =>
      json(
        { error: { message: "(#200) Permissions error" } },
        403
      )) as unknown as typeof fetch);
    expect(denied).toMatchObject({
      ok: false,
      detail: "(#200) Permissions error",
    });
    expect((await subscribeApp(env)).ok).toBe(false);
  });
});
