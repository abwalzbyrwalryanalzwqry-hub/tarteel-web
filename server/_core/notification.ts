import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { logger } from "./logger";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * يرسل إشعاراً لمالك المنصة عبر Webhook عام (OWNER_NOTIFY_WEBHOOK_URL) يستقبل JSON
 * {title, content, text} — Slack/Discord/n8n أو وسيط Telegram.
 * يعيد true عند القبول وfalse إن لم تُضبط قناة أو فشل الإرسال.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (ENV.ownerWebhookUrl) {
    try {
      const response = await fetch(ENV.ownerWebhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content, text: `${title}\n\n${content}` }),
      });
      if (!response.ok) logger.warn({ status: response.status }, "[Notification] webhook failed");
      return response.ok;
    } catch (error) {
      logger.warn({ err: error }, "[Notification] webhook error");
      return false;
    }
  }

  logger.info({ title, content: content.slice(0, 500) }, "[Notification] no channel configured");
  return false;
}
