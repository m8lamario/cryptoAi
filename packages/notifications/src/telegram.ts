/**
 * Phase 6 — Telegram Notifier.
 *
 * Sends critical events to the owner via Telegram Bot API.
 * No external dependencies — uses fetch to Telegram HTTP API.
 */

export interface TelegramConfig {
  /** Telegram Bot Token (from @BotFather) */
  botToken: string;
  /** Chat ID to send messages to */
  chatId: string;
  /** Whether to suppress notifications (default: false) */
  disableNotification?: boolean;
}

export interface NotificationEvent {
  type:
    | "OPPORTUNITY_DETECTED"
    | "PROPOSAL_BLOCKED"
    | "APPROVAL_REQUIRED"
    | "AI_BUDGET_EXHAUSTED"
    | "DATA_STALE"
    | "SERVICE_UNAVAILABLE"
    | "KILL_SWITCH_ACTIVATED"
    | "KILL_SWITCH_DEACTIVATED"
    | "SYSTEM_ERROR"
    | "INFO";
  title: string;
  message: string;
  details?: Record<string, string | number | null>;
}

export class TelegramNotifier {
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly disableNotification: boolean;
  private readonly baseUrl: string;

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.disableNotification = config.disableNotification ?? false;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send a notification to the owner.
   * Returns true if sent successfully, false otherwise.
   * Failures are silently logged — notifications are best-effort.
   */
  async send(event: NotificationEvent): Promise<boolean> {
    const emoji = getEmoji(event.type);
    const text = formatMessage(event, emoji);

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: "HTML",
          disable_notification: this.disableNotification,
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Telegram notification failed: ${response.status} ${body}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error("Telegram notification error:", err);
      return false;
    }
  }

  /** Send multiple notifications in sequence (best-effort) */
  async sendBatch(events: NotificationEvent[]): Promise<number> {
    let successCount = 0;
    for (const event of events) {
      const ok = await this.send(event);
      if (ok) successCount++;
    }
    return successCount;
  }

  /** Test: send a simple "System online" message */
  async sendTest(): Promise<boolean> {
    return this.send({
      type: "INFO",
      title: "System Online",
      message: "CryptoAI hybrid investment agent is now online.",
      details: { timestamp: new Date().toISOString() },
    });
  }
}

function getEmoji(type: NotificationEvent["type"]): string {
  switch (type) {
    case "OPPORTUNITY_DETECTED": return "🎯";
    case "PROPOSAL_BLOCKED": return "🛑";
    case "APPROVAL_REQUIRED": return "✋";
    case "AI_BUDGET_EXHAUSTED": return "💸";
    case "DATA_STALE": return "⏰";
    case "SERVICE_UNAVAILABLE": return "🔴";
    case "KILL_SWITCH_ACTIVATED": return "🚨";
    case "KILL_SWITCH_DEACTIVATED": return "✅";
    case "SYSTEM_ERROR": return "💥";
    case "INFO": return "ℹ️";
  }
}

function formatMessage(event: NotificationEvent, emoji: string): string {
  let text = `${emoji} <b>${escapeHtml(event.title)}</b>\n\n`;
  text += `${escapeHtml(event.message)}\n`;

  if (event.details) {
    for (const [key, value] of Object.entries(event.details)) {
      if (value !== null && value !== undefined) {
        text += `\n<b>${escapeHtml(key)}</b>: ${escapeHtml(String(value))}`;
      }
    }
  }

  return text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

