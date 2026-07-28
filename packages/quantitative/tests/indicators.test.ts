import { describe, it, expect } from "vitest";
import { sma, ema, rsi, macd, atr, volatility, latestValue } from "../src/indicators.js";
import type { IndicatorInput } from "../src/indicators.js";

function makeCandles(prices: number[]): IndicatorInput[] {
  return prices.map((p, i) => ({
    openTime: i * 900000, // 15 min steps in ms
    close: p,
    high: p * 1.01,
    low: p * 0.99,
    volume: 1000,
  }));
}

describe("SMA", () => {
  it("returns null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = sma(candles, 5);
    expect(result).toEqual([null, null, null]);
  });

  it("computes SMA correctly", () => {
    const candles = makeCandles([10, 20, 30, 40, 50]);
    const result = sma(candles, 3);
    // Period=3: first 2 null, then (10+20+30)/3=20, (20+30+40)/3=30, (30+40+50)/3=40
    expect(result).toEqual([null, null, 20, 30, 40]);
  });

  it("handles single candle", () => {
    const candles = makeCandles([42]);
    const result = sma(candles, 1);
    expect(result).toEqual([42]);
  });

  it("returns all null for period 0", () => {
    const candles = makeCandles([10, 20, 30]);
    const result = sma(candles, 0);
    expect(result).toEqual([null, null, null]);
  });
});

describe("EMA", () => {
  it("returns null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = ema(candles, 5);
    expect(result).toEqual([null, null, null]);
  });

  it("computes EMA for period 1 (equals price)", () => {
    const candles = makeCandles([10, 20, 30]);
    const result = ema(candles, 1);
    expect(result[0]).toBeCloseTo(10, 5);
    expect(result[1]).toBeCloseTo(20, 5);
    expect(result[2]).toBeCloseTo(30, 5);
  });

  it("EMA(3) converges as expected", () => {
    const candles = makeCandles([10, 10, 10, 20, 20, 20]);
    const result = ema(candles, 3);
    // First SMA at index 2 = 10, then EMA evolves
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(10, 5);
    // multiplier = 2/(3+1) = 0.5
    // EMA3 = (20 - 10) * 0.5 + 10 = 15
    expect(result[3]).toBeCloseTo(15, 5);
    // EMA4 = (20 - 15) * 0.5 + 15 = 17.5
    expect(result[4]).toBeCloseTo(17.5, 5);
    // EMA5 = (20 - 17.5) * 0.5 + 17.5 = 18.75
    expect(result[5]).toBeCloseTo(18.75, 5);
  });
});

describe("RSI", () => {
  it("returns null for insufficient data", () => {
    const candles = makeCandles([100, 101]);
    // Need period+1 = 15 candles for default RSI(14)
    const result = rsi(candles);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it("RSI is 100 when only gains (all up)", () => {
    // Create 16 candles, all increasing by 1
    const prices = Array.from({ length: 16 }, (_, i) => 100 + i);
    const candles = makeCandles(prices);
    const result = rsi(candles);
    // After period 14, all gains => RSI = 100
    const valid = result.filter((v) => v !== null);
    expect(valid.length).toBeGreaterThan(0);
    for (const v of valid) {
      expect(v).toBe(100);
    }
  });

  it("RSI is 0 when only losses (all down)", () => {
    const prices = Array.from({ length: 16 }, (_, i) => 100 - i);
    const candles = makeCandles(prices);
    const result = rsi(candles);
    const valid = result.filter((v) => v !== null);
    expect(valid.length).toBeGreaterThan(0);
    for (const v of valid) {
      expect(v).toBe(0);
    }
  });

  it("RSI falls in 0-100 range for mixed prices", () => {
    const prices = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    const candles = makeCandles(prices);
    const result = rsi(candles, 14);
    const lastValid = latestValue(result);
    expect(lastValid).not.toBeNull();
    expect(lastValid!).toBeGreaterThan(0);
    expect(lastValid!).toBeLessThan(100);
  });
});

describe("MACD", () => {
  it("returns nulls for insufficient data", () => {
    const candles = makeCandles([10, 20]);
    const result = macd(candles, 12, 26, 9);
    expect(result.macd.every((v) => v === null)).toBe(true);
  });

  it("MACD is 0 for flat prices", () => {
    // Need at least 26 candles for slow EMA seed
    const candles = makeCandles(Array.from({ length: 30 }, () => 100));
    const result = macd(candles, 12, 26, 9);
    const valid = result.macd.filter((v) => v !== null);
    for (const v of valid) {
      expect(v).toBeCloseTo(0, 1);
    }
  });

  it("MACD, signal, histogram have correct lengths", () => {
    const candles = makeCandles(Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.5) * 10));
    const result = macd(candles);
    expect(result.macd).toHaveLength(40);
    expect(result.signal).toHaveLength(40);
    expect(result.histogram).toHaveLength(40);
  });
});

describe("ATR", () => {
  it("returns null for insufficient data", () => {
    const candles = makeCandles([100, 101]);
    const result = atr(candles, 14);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it("ATR is positive for volatile candles", () => {
    const candles: IndicatorInput[] = [];
    for (let i = 0; i < 20; i++) {
      const close = 100 + Math.sin(i * 0.5) * 10;
      candles.push({
        openTime: i * 900000,
        close,
        high: close + 2,
        low: close - 2,
        volume: 1000,
      });
    }
    const result = atr(candles, 14);
    const lastValid = latestValue(result);
    expect(lastValid).toBeGreaterThan(0);
  });
});

describe("Volatility", () => {
  it("returns null for insufficient data", () => {
    const candles = makeCandles([100, 101]);
    const result = volatility(candles, 20);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it("volatility is 0 for flat prices", () => {
    const candles = makeCandles(Array.from({ length: 25 }, () => 100));
    const result = volatility(candles, 20);
    const lastValid = latestValue(result);
    expect(lastValid).toBeCloseTo(0, 5);
  });

  it("volatility is positive for varying prices", () => {
    const candles = makeCandles(Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i * 0.3) * 5));
    const result = volatility(candles, 20);
    const lastValid = latestValue(result);
    expect(lastValid).toBeGreaterThan(0);
  });
});

describe("latestValue", () => {
  it("returns last non-null", () => {
    expect(latestValue([null, null, 42, null, 99])).toBe(99);
  });

  it("returns null if all null", () => {
    expect(latestValue([null, null])).toBeNull();
  });
});

