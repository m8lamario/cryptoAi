import { describe, expect, it } from "vitest";
import { runWalkForward } from "../src/walk-forward.js";

function candles(count: number) {
  return Array.from({ length: count }, (_, i) => ({ openTime: i * 900_000, closeTime: i * 900_000 + 899_000, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 10 }));
}

describe("M9 walk-forward", () => {
  it("creates out-of-sample folds and never permits execution", () => {
    const result = runWalkForward({ asset: "BTCUSDT", candles: candles(120), initialQuote: 10_000, trainCandles: 50, validationCandles: 20, testCandles: 20, commissionRate: 0.001, spreadPercent: 0.02, slippagePercent: 0.05, executionPolicy: "NO_EXECUTION" });
    expect(result.folds.length).toBeGreaterThan(0);
    expect(result.executionPolicy).toBe("NO_EXECUTION");
    expect(result.testMetrics.QUANTITATIVE.outOfSample).toBe(true);
  });
  it("rejects a non-NO_EXECUTION policy", () => {
    expect(() => runWalkForward({ asset: "BTCUSDT", candles: candles(100), initialQuote: 10_000, trainCandles: 40, validationCandles: 20, testCandles: 20, commissionRate: 0.001, spreadPercent: 0.02, slippagePercent: 0.05, executionPolicy: "PAPER_ALLOWED" as "NO_EXECUTION" })).toThrow();
  });
});

