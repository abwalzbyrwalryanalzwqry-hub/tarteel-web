/**
 * Webhook واتساب لاستقبال رسائل التحقق العكسي:
 *   GET  /api/whatsapp/webhook  تأكيد الاشتراك من Meta (hub.verify_token ← hub.challenge)
 *   POST /api/whatsapp/webhook  الرسائل الواردة، بعد التحقق من توقيع X-Hub-Signature-256
 *
 * يُسجَّل قبل express.json العام لأن التوقيع يُحسب على الجسم الخام.
 * يرد 200 دائماً للطلبات الموقعة حتى لا تعيد Meta إرسالها؛ الأخطاء تُسجَّل فقط.
 */
import express, { type Express } from "express";
import { timingSafeEqual } from "node:crypto";
import { handleInboundWhatsAppMessage } from "../auth/whatsappVerification";
import { logger } from "./logger";
import {
  extractInboundTextMessages,
  getWhatsAppConfig,
  isValidWebhookSignature,
  sendWhatsAppReply,
} from "./whatsapp";

export const WHATSAPP_WEBHOOK_PATH = "/api/whatsapp/webhook";

const sameSecret = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const REPLIES = {
  verified: "تم تأكيد رقمك في ترتيل. ارجع إلى الصفحة لإكمال العملية.",
  mismatch:
    "وصل الرمز من رقم غير الرقم المكتوب في ترتيل. أرسله من واتساب الرقم نفسه، ثم اطلب رمزاً جديداً.",
} as const;

export function registerWhatsAppWebhook(app: Express) {
  app.get(WHATSAPP_WEBHOOK_PATH, (req, res) => {
    const config = getWhatsAppConfig();
    const token = String(req.query["hub.verify_token"] ?? "");
    if (
      !config ||
      req.query["hub.mode"] !== "subscribe" ||
      !sameSecret(token, config.verifyToken)
    ) {
      res.sendStatus(403);
      return;
    }
    res
      .type("text/plain")
      .send(String(req.query["hub.challenge"] ?? "").slice(0, 200));
  });

  app.post(
    WHATSAPP_WEBHOOK_PATH,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      const config = getWhatsAppConfig();
      if (!config) {
        res.sendStatus(404);
        return;
      }
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (
        !isValidWebhookSignature(
          raw,
          req.header("x-hub-signature-256"),
          config.appSecret
        )
      ) {
        res.sendStatus(401);
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(raw.toString("utf8"));
      } catch {
        res.sendStatus(400);
        return;
      }
      for (const message of extractInboundTextMessages(payload)) {
        try {
          const result = await handleInboundWhatsAppMessage(
            message.from,
            message.text
          );
          if (result !== "ignored")
            await sendWhatsAppReply(config, message.from, REPLIES[result]);
        } catch (error) {
          logger.warn({ err: error }, "[WhatsApp] inbound message failed");
        }
      }
      res.sendStatus(200);
    }
  );
}
