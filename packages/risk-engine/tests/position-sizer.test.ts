import { describe, it, expect } from "vitest";
import { computePositionSize } from "../src/position-sizer.js";

describe("computePositionSize", () => {
  const baseInput = {
    portfolioValue: 10000,
    entryPrice: 100,
    atrValue: 5,
    riskFraction: 0.02,
    maxAssetExposurePercent: 30,
    minPositionSize: 0.001,
  };

  it("computes position size with ATR-based stop loss", () => {
    const result = computePositionSize(baseInput);
    // riskAmount = 10000 * 0.02 = 200
    // stopLoss = 100 - 2*5 = 90
    // riskPerUnit = 100 - 90 = 10
    // positionSize = 200 / 10 = 20
    expect(result.positionSize).toBeCloseTo(20, 5);
    expect(result.stopLoss).toBeCloseTo(90, 5);
    expect(result.riskAmount).toBeCloseTo(200, 2);
  });

  it("uses fallback stop when ATR is null", () => {
    const result = computePositionSize({ ...baseInput, atrValue: null });
    // fallbackStopDistance = 100 * 0.05 = 5
    // riskAmount = 200, positionSize = 200 / 5 = 40
    // but maxAssetExposurePercent (30%) caps at 3000/100 = 30
    expect(result.positionSize).toBeCloseTo(30, 5);
    expect(result.stopLoss).toBeNull();
  });

  it("enforces max asset exposure limit", () => {
    const result = computePositionSize({
      ...baseInput,
      portfolioValue: 10000,
      entryPrice: 100,
      riskFraction: 0.5, // 5000 risk amount
      maxAssetExposurePercent: 10, // max 1000 notional
    });
    // Max position = 1000 / 100 = 10
    expect(result.positionSize).toBeCloseTo(10, 5);
  });

  it("returns 0 when position is below minimum", () => {
    const result = computePositionSize({
      ...baseInput,
      portfolioValue: 100,
      riskFraction: 0.01, // 1
      entryPrice: 50000,
      minPositionSize: 0.01,
    });
    expect(result.positionSize).toBe(0);
  });

  it("handles zero portfolio value", () => {
    const result = computePositionSize({
      ...baseInput,
      portfolioValue: 0,
    });
    expect(result.positionSize).toBe(0);
    expect(result.riskAmount).toBe(0);
  });
});
