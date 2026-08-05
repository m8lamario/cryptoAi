import { describe, expect, it } from "vitest";
import { scoreDirectionalBaseline } from "../src/directional-baseline.js";
import { rollingPercentile, rollingZScore } from "../src/rolling-normalization.js";
import { estimateTradingCosts } from "../src/cost-model.js";
import type { IndicatorInput } from "../src/indicators.js";

function candles(closes: number[]): IndicatorInput[] {
  return closes.map((close, index) => ({
    openTime: index * 900_000,
    close,
    high: close * 1.01,
    low: close * 0.99,
    volume: 1000,
  }));
}

describe("M3 rolling normalization", () => {
  it("uses only values available at the current index", () => {
    const values = [1, 2, 3, 4, 100];
    const beforeFuture = rollingZScore(values, 2, { window: 3 });
    expect(beforeFuture).toBeCloseTo(1.2247, 3);
    expect(rollingPercentile(values, 2, { window: 3 })).toBe(1);
  });
});

describe("M3 cost model", () => {
  it("keeps cost components additive and non-negative", () => {
    const estimate = estimateTradingCosts({
      notional: 1000,
      commissionRate: 0.001,
      spreadPercent: 0.1,
      slippagePercent: 0.2,
      expectedTurnover: 0.05,
    });
    expect(estimate.total).toBeCloseTo(6.5, 8);
    expect(estimate.total).toBeGreaterThan(estimate.fees);
  });
});

describe("M3 directional baseline", () => {
  it("returns LONG for a sufficiently strong rising series", () => {
    const result = scoreDirectionalBaseline("BTCUSDT", candles(Array.from({ length: 100 }, (_, i) => 100 + i)));
    expect(result.direction).toBe("LONG");
    expect(result.directionScore).toBeGreaterThan(0);
    expect(result.formulaVersion).toBe("m3-directional-v1");
  });

  it("returns SHORT for a sufficiently strong falling series", () => {
    const result = scoreDirectionalBaseline("BTCUSDT", candles(Array.from({ length: 100 }, (_, i) => 200 - i)));
    expect(result.direction).toBe("SHORT");
    expect(result.directionScore).toBeLessThan(0);
  });

  it("returns FLAT when costs overwhelm the expected edge", () => {
    const result = scoreDirectionalBaseline("BTCUSDT", candles(Array.from({ length: 100 }, (_, i) => 100 + i * 0.01)), {
      spreadPercent: 10,
      slippagePercent: 10,
      expectedTurnover: 1,
    });
    expect(result.direction).toBe("FLAT");
    expect(result.netEdge).toBeLessThanOrEqual(0);
  });
});
