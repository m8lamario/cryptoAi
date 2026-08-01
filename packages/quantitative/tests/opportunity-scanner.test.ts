import { describe, it, expect } from "vitest";
import {
  scanOpportunity,
  scanAllAssets,
  DEFAULT_SCANNER_WEIGHTS,
} from "../src/opportunity-scanner.js";
import type { IndicatorInput } from "../src/indicators.js";
import { IndicatorInputSchema } from "../src/indicators.js";

/**
 * Generate synthetic candles for testing.
 * Every candle has the same structure.
 */
function generateCandles(
  count: number,
  basePrice: number,
  volatility: number = 0.01,
): IndicatorInput[] {
  const candles: IndicatorInput[] = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility * price;
    const close = price + change;
    const high = close + Math.random() * volatility * price * 0.5;
    const low = close - Math.random() * volatility * price * 0.5;
    const open = price;
    const volume = 100 + Math.random() * 50;
    candles.push({
      openTime: i * 900_000,
      close,
      high,
      low,
      open,
      volume,
    });
    price = close;
  }
  return candles;
}

describe("scanOpportunity", () => {
  it("returns IGNORE for insufficient data (<50 candles)", () => {
    const candles = generateCandles(10, 65000);
    const result = scanOpportunity("BTCUSDT", candles);
    expect(result.score).toBe(0);
    expect(result.classification).toBe("IGNORE");
  });

  it("returns a score for sufficient data (>=50 candles)", () => {
    const candles = generateCandles(60, 65000, 0.02); // high vol
    const result = scanOpportunity("BTCUSDT", candles);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.classification).toBeDefined();
  });

  it("returns all 6 components", () => {
    const candles = generateCandles(60, 65000, 0.02);
    const result = scanOpportunity("BTCUSDT", candles);
    expect(result.components).toHaveLength(6);
    const names = result.components.map((c) => c.name);
    expect(names).toContain("RSI");
    expect(names).toContain("MACD");
    expect(names).toContain("Volatility");
    expect(names).toContain("Volume");
    expect(names).toContain("Trend");
    expect(names).toContain("Breakout");
  });

  it("each component has value 0-100 and weight 0-1", () => {
    const candles = generateCandles(60, 65000, 0.02);
    const result = scanOpportunity("BTCUSDT", candles);
    for (const component of result.components) {
      expect(component.value).toBeGreaterThanOrEqual(0);
      expect(component.value).toBeLessThanOrEqual(100);
      expect(component.weight).toBeGreaterThan(0);
      expect(component.weight).toBeLessThanOrEqual(1);
    }
  });

  it("classifies correctly for each range", () => {
    // All scores returned are deterministic for given candles.
    // We verify that classification matches the score range.
    const candles = generateCandles(60, 65000, 0.02);
    const result = scanOpportunity("BTCUSDT", candles);

    if (result.score <= 30) expect(result.classification).toBe("IGNORE");
    else if (result.score <= 60) expect(result.classification).toBe("MONITORING");
    else if (result.score <= 80) expect(result.classification).toBe("AI_ANALYSIS");
    else expect(result.classification).toBe("MAX_PRIORITY");
  });

  it("uses custom weights when provided", () => {
    const candles = generateCandles(60, 65000, 0.02);
    const resultDefault = scanOpportunity("BTCUSDT", candles);
    const resultCustom = scanOpportunity("BTCUSDT", candles, {
      rsi: 1.0,
      macd: 0,
      volatility: 0,
      volume: 0,
      trend: 0,
      breakout: 0,
    });
    // With RSI at weight 1.0, the score should be different
    expect(resultCustom.score).not.toBe(resultDefault.score);
  });

  it("scanAllAssets returns one result per asset", () => {
    const candles = generateCandles(60, 65000, 0.02);
    const assets = [{ symbol: "BTCUSDT" }, { symbol: "ETHUSDT" }];
    const map = new Map([
      ["BTCUSDT", candles],
      ["ETHUSDT", generateCandles(60, 3000, 0.02)],
    ]);
    const results = scanAllAssets(assets, map);
    expect(results).toHaveLength(2);
    expect(results[0]!.asset).toBe("BTCUSDT");
    expect(results[1]!.asset).toBe("ETHUSDT");
  });
});

