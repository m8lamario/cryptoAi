import { describe, it, expect } from "vitest";
import {
  AIDecisionMemorySchema,
  MemoryOutcomeSchema,
  CHECKPOINT_TIMINGS,
} from "../src/ai-memory.js";
import type { AIDecisionMemory } from "../src/ai-memory.js";

describe("AIDecisionMemory", () => {
  const validMemory: AIDecisionMemory = {
    id: "mem-001",
    proposalRunId: "proposal-run-123",
    asset: "BTC",
    action: "BUY",
    strategy: "SWING",
    entryPrice: 65000,
    indicatorsJson: { rsi14: 35, sma20: 64800 },
    modelUsed: "deepseek/deepseek-chat",
    promptVersion: "1.0.0",
    confidenceAtDecision: 0.75,
    decidedAt: "2026-08-01T12:00:00Z",
    outcomes: [
      {
        checkpoint: "AFTER_1H",
        profitLossPercent: 0.5,
        wasCorrect: true,
        priceAtCheckpoint: 65325,
        recordedAt: "2026-08-01T13:00:00Z",
      },
    ],
    finalResult: 2.5,
    createdAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-02T12:00:00Z",
  };

  it("accepts a valid AIDecisionMemory", () => {
    const result = AIDecisionMemorySchema.safeParse(validMemory);
    expect(result.success).toBe(true);
  });

  it("accepts null strategy", () => {
    const result = AIDecisionMemorySchema.safeParse({ ...validMemory, strategy: null });
    expect(result.success).toBe(true);
  });

  it("accepts null finalResult", () => {
    const result = AIDecisionMemorySchema.safeParse({ ...validMemory, finalResult: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = AIDecisionMemorySchema.safeParse({ ...validMemory, action: "HODL" });
    expect(result.success).toBe(false);
  });

  it("rejects confidence > 1", () => {
    const result = AIDecisionMemorySchema.safeParse({ ...validMemory, confidenceAtDecision: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe("MemoryOutcome", () => {
  it("accepts a valid outcome", () => {
    const result = MemoryOutcomeSchema.safeParse({
      checkpoint: "AFTER_24H",
      profitLossPercent: -1.2,
      wasCorrect: false,
      priceAtCheckpoint: 64200,
      recordedAt: "2026-08-02T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null wasCorrect", () => {
    const result = MemoryOutcomeSchema.safeParse({
      checkpoint: "AFTER_1H",
      profitLossPercent: 0,
      wasCorrect: null,
      priceAtCheckpoint: 65000,
      recordedAt: "2026-08-01T13:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all checkpoint types", () => {
    for (const cp of ["AT_OPEN", "AFTER_1H", "AFTER_6H", "AFTER_24H", "AFTER_7D", "AFTER_30D"] as const) {
      const result = MemoryOutcomeSchema.safeParse({
        checkpoint: cp,
        profitLossPercent: 1.0,
        wasCorrect: true,
        priceAtCheckpoint: 65650,
        recordedAt: "2026-08-01T18:00:00Z",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("CHECKPOINT_TIMINGS", () => {
  it("AT_OPEN is 0ms", () => {
    expect(CHECKPOINT_TIMINGS.AT_OPEN).toBe(0);
  });

  it("AFTER_1H is 3600000ms", () => {
    expect(CHECKPOINT_TIMINGS.AFTER_1H).toBe(3_600_000);
  });

  it("AFTER_24H is 86400000ms", () => {
    expect(CHECKPOINT_TIMINGS.AFTER_24H).toBe(86_400_000);
  });

  it("AFTER_7D is 604800000ms", () => {
    expect(CHECKPOINT_TIMINGS.AFTER_7D).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("AFTER_30D is 2592000000ms", () => {
    expect(CHECKPOINT_TIMINGS.AFTER_30D).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("all checkpoints are in ascending order", () => {
    const values = Object.values(CHECKPOINT_TIMINGS);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});
