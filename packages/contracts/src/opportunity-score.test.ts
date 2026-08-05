import { describe, it, expect } from "vitest";
import {
  MarketOpportunityScoreSchema,
  classifyOpportunity,
  DirectionalQuantitativeScoreSchema,
} from "../src/opportunity-score.js";
import type { MarketOpportunityScore } from "../src/opportunity-score.js";

describe("MarketOpportunityScore", () => {
  const validScore: MarketOpportunityScore = {
    asset: "BTC",
    score: 72,
    classification: "QUANTITATIVE_ANALYSIS",
    components: [
      { name: "RSI", value: 65, weight: 0.2 },
      { name: "MACD", value: 80, weight: 0.2 },
      { name: "Volume", value: 70, weight: 0.15 },
    ],
    evaluatedAt: "2026-08-01T12:00:00Z",
  };

  it("accepts a valid MarketOpportunityScore", () => {
    const result = MarketOpportunityScoreSchema.safeParse(validScore);
    expect(result.success).toBe(true);
  });

  it("rejects score > 100", () => {
    const result = MarketOpportunityScoreSchema.safeParse({ ...validScore, score: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects score < 0", () => {
    const result = MarketOpportunityScoreSchema.safeParse({ ...validScore, score: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid classification", () => {
    const result = MarketOpportunityScoreSchema.safeParse({ ...validScore, classification: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("rejects component with value > 100", () => {
    const result = MarketOpportunityScoreSchema.safeParse({
      ...validScore,
      components: [{ name: "X", value: 101, weight: 0.5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects component with weight > 1", () => {
    const result = MarketOpportunityScoreSchema.safeParse({
      ...validScore,
      components: [{ name: "X", value: 50, weight: 1.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("classifyOpportunity", () => {
  it("classifies 0-30 as IGNORE", () => {
    expect(classifyOpportunity(0)).toBe("IGNORE");
    expect(classifyOpportunity(15)).toBe("IGNORE");
    expect(classifyOpportunity(30)).toBe("IGNORE");
  });

  it("classifies 31-60 as MONITORING", () => {
    expect(classifyOpportunity(31)).toBe("MONITORING");
    expect(classifyOpportunity(45)).toBe("MONITORING");
    expect(classifyOpportunity(60)).toBe("MONITORING");
  });

  it("classifies 61-80 as QUANTITATIVE_ANALYSIS", () => {
    expect(classifyOpportunity(61)).toBe("QUANTITATIVE_ANALYSIS");
    expect(classifyOpportunity(70)).toBe("QUANTITATIVE_ANALYSIS");
    expect(classifyOpportunity(80)).toBe("QUANTITATIVE_ANALYSIS");
  });

  it("classifies 81+ as AI_ANALYSIS", () => {
    expect(classifyOpportunity(81)).toBe("AI_ANALYSIS");
    expect(classifyOpportunity(95)).toBe("AI_ANALYSIS");
    expect(classifyOpportunity(100)).toBe("AI_ANALYSIS");
  });
});

describe("DirectionalQuantitativeScore M3", () => {
  const score = {
    asset: "BTC",
    score: 72,
    classification: "QUANTITATIVE_ANALYSIS" as const,
    components: [{ name: "RSI", value: 65, weight: 0.2 }],
    evaluatedAt: "2026-08-01T12:00:00Z",
    direction: "LONG",
    opportunityIntensity: 75,
    directionScore: 42,
    expectedMove: 2.5,
    expectedRisk: 1.2,
    estimatedCosts: { spread: 0.1, slippage: 0.2, fees: 0.1, turnover: 0.05, total: 0.45 },
    netEdge: 1.45,
    horizonCandles: 16,
    formulaVersion: "m3-directional-v1",
    featureVersion: "m3-features-v1",
    features: { momentum1h: 0.2, signedTrend: null },
  };

  it("accepts a complete directional score", () => {
    expect(DirectionalQuantitativeScoreSchema.safeParse(score).success).toBe(true);
  });

  it("accepts negative net edge and rejects invalid direction", () => {
    expect(DirectionalQuantitativeScoreSchema.safeParse({ ...score, netEdge: -1 }).success).toBe(true);
    expect(DirectionalQuantitativeScoreSchema.safeParse({ ...score, direction: "BUY" }).success).toBe(false);
  });
});
