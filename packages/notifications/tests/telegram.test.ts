import { describe, it, expect } from "vitest";
import { TelegramNotifier } from "../src/telegram.js";
import type { NotificationEvent } from "../src/telegram.js";

describe("TelegramNotifier", () => {
  const config = {
    botToken: "test-bot-token",
    chatId: "123456789",
  };

  it("constructs with valid config", () => {
    const notifier = new TelegramNotifier(config);
    expect(notifier).toBeDefined();
  });

  it("formats messages without throwing", async () => {
    const notifier = new TelegramNotifier(config);

    const events: NotificationEvent[] = [
      {
        type: "OPPORTUNITY_DETECTED",
        title: "Buy Signal Detected",
        message: "BTCUSDT shows strong buy signal from 3 agents.",
        details: { asset: "BTCUSDT", confidence: "0.85", score: "0.72" },
      },
      {
        type: "PROPOSAL_BLOCKED",
        title: "Proposal Blocked by Risk Manager",
        message: "Risk check MAX_DAILY_LOSS blocked the proposal.",
        details: { ruleCode: "MAX_DAILY_LOSS", observedValue: "5.2%", limit: "5.0%" },
      },
      {
        type: "AI_BUDGET_EXHAUSTED",
        title: "AI Budget Exhausted",
        message: "Daily AI budget of $1.00 has been reached.",
        details: { dailySpent: "1.00", monthlySpent: "15.50" },
      },
      {
        type: "KILL_SWITCH_ACTIVATED",
        title: "Kill Switch Activated",
        message: "Kill switch was activated manually.",
        details: { reason: "Manual override by owner" },
      },
      {
        type: "SYSTEM_ERROR",
        title: "System Error",
        message: "Database connection lost.",
        details: { error: "Connection refused", timestamp: new Date().toISOString() },
      },
    ];

    for (const event of events) {
      // Just verify it doesn't throw — actual HTTP call fails without real token
      const result = await notifier.send(event);
      // Will fail because no real token, but shouldn't throw
      expect(typeof result).toBe("boolean");
    }
  });

  it("sendTest returns boolean", async () => {
    const notifier = new TelegramNotifier(config);
    const result = await notifier.sendTest();
    expect(typeof result).toBe("boolean");
  });
});

