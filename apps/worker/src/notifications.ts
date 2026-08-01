import { getTelegramConfig } from "@cryptoai/config";
import { TelegramNotifier } from "@cryptoai/notifications";
import type { NotificationEvent } from "@cryptoai/notifications";
import { logger } from "./logger.js";

export interface NotificationTransport {
  send(event: NotificationEvent): Promise<boolean>;
}

export type NotificationSender = (event: NotificationEvent) => Promise<void>;

/** Returns true when an agent/gateway reason indicates an exhausted AI budget. */
export function isBudgetExhaustedReason(reason: string): boolean {
  return /budget(?: would be)? exceeded/i.test(reason);
}

/**
 * Wraps Telegram delivery so notification failures never affect orchestration.
 * The transport is injectable to keep orchestration tests independent from HTTP.
 */
export function createNotificationSender(transport: NotificationTransport | null): NotificationSender {
  return async (event) => {
    if (!transport) return;

    try {
      const sent = await transport.send(event);
      if (!sent) {
        logger.warn({ eventType: event.type }, "Notification delivery failed");
      }
    } catch (err) {
      logger.warn({ err, eventType: event.type }, "Notification delivery error");
    }
  };
}

/** Builds an optional Telegram sender from server-side environment variables. */
export function createConfiguredNotificationSender(): NotificationSender {
  try {
    const config = getTelegramConfig();
    return createNotificationSender(config ? new TelegramNotifier(config) : null);
  } catch (err) {
    logger.error({ err }, "Invalid Telegram configuration; notifications disabled");
    return createNotificationSender(null);
  }
}

export { type NotificationEvent } from "@cryptoai/notifications";

