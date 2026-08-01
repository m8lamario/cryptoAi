import { describe, it, expect } from "vitest";
import { TradingPlanSchema } from "../src/trading-plan.js";
import type { TradingPlan } from "../src/trading-plan.js";

describe("TradingPlanSchema", () => {
  const validPlan: TradingPlan = {
    strategy: "SWING",
    expectedDuration: "3-7 days",
    expectedProfitPercent: 8.5,
    expectedRiskPercent: 2.0,
    confidence: 0.75,
    suggestedEntry: 65000,
    suggestedTakeProfit: 70500,
    suggestedStopLoss: 63700,
    urgency: "MEDIUM",
    reasons: ["Bullish breakout from consolidation", "RSI trending up with room to run"],
  };

  it("accepts a valid TradingPlan", () => {
    const result = TradingPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it("rejects when confidence > 1", () => {
    const result = TradingPlanSchema.safeParse({ ...validPlan, confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects when confidence < 0", () => {
    const result = TradingPlanSchema.safeParse({ ...validPlan, confidence: -0.1 });
    expect(result.success).toBe(false);
  });

  it("rejects missing reasons", () => {
    const result = TradingPlanSchema.safeParse({ ...validPlan, reasons: [] });
    expect(result.success).toBe(false);
  });

  it("accepts all strategy types", () => {
    for (const strategy of ["SCALPING", "INTRADAY", "SWING", "POSITION"] as const) {
      const result = TradingPlanSchema.safeParse({ ...validPlan, strategy });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid strategy", () => {
    const result = TradingPlanSchema.safeParse({ ...validPlan, strategy: "HFT" });
    expect(result.success).toBe(false);
  });

  it("accepts all urgency levels", () => {
    for (const urgency of ["LOW", "MEDIUM", "HIGH"] as const) {
      const result = TradingPlanSchema.safeParse({ ...validPlan, urgency });
      expect(result.success).toBe(true);
    }
  });

  it("rejects negative entry price", () => {
    const result = TradingPlanSchema.safeParse({ ...validPlan, suggestedEntry: -1 });
    expect(result.success).toBe(false);
  });
});

