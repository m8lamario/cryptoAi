import { describe, expect, it, vi } from "vitest";
import {
  createNotificationSender,
  isBudgetExhaustedReason,
} from "../src/notifications.js";
import type { NotificationEvent } from "@cryptoai/notifications";

describe("worker notification wiring", () => {
  it("recognizes both budget exhaustion messages", () => {
    expect(isBudgetExhaustedReason("Budget exceeded: daily=1.0000")).toBe(true);
    expect(isBudgetExhaustedReason("Budget would be exceeded by this call cost")).toBe(true);
    expect(isBudgetExhaustedReason("AI provider timed out")).toBe(false);
  });

  it("does nothing when Telegram is not configured", async () => {
    const send = vi.fn();
    const notify = createNotificationSender(null);

    await notify({
      type: "DATA_STALE",
      title: "Market Data Stale",
      message: "No fresh market data was available.",
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("swallows transport failures and reports successful delivery", async () => {
    const events: NotificationEvent[] = [];
    const notify = createNotificationSender({
      send: vi.fn(async (event: NotificationEvent) => {
        events.push(event);
        return true;
      }),
    });

    await notify({
      type: "PROPOSAL_BLOCKED",
      title: "Proposal Blocked",
      message: "Risk veto",
      details: { ruleCode: "MAX_DAILY_LOSS" },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("PROPOSAL_BLOCKED");
  });

  it("does not propagate transport exceptions", async () => {
    const notify = createNotificationSender({
      send: vi.fn(async () => {
        throw new Error("network unavailable");
      }),
    });

    await expect(
      notify({
        type: "KILL_SWITCH_ACTIVATED",
        title: "Kill Switch Activated",
        message: "Trading blocked",
      }),
    ).resolves.toBeUndefined();
  });
});

