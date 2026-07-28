import { describe, it, expect } from "vitest";
import { computePnl, computeUnrealizedPnl } from "../src/pnl.js";

describe("computePnl", () => {
  it("computes profit for a BUY trade", () => {
    const result = computePnl({
      side: "BUY",
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      commissionRate: 0.001,
      slippagePercent: 0,
    });
    expect(result.grossPnl).toBeCloseTo(10, 5);
    expect(result.commissionCost).toBeCloseTo(0.21, 5); // 100*0.001 + 110*0.001
    expect(result.slippageCost).toBe(0);
    expect(result.netPnl).toBeCloseTo(9.79, 5);
    expect(result.grossReturnPercent).toBeCloseTo(10, 5);
    expect(result.netReturnPercent).toBeCloseTo(9.79, 5);
  });

  it("computes loss for a BUY trade", () => {
    const result = computePnl({
      side: "BUY",
      entryPrice: 100,
      exitPrice: 90,
      quantity: 1,
      commissionRate: 0.001,
      slippagePercent: 0,
    });
    expect(result.grossPnl).toBeCloseTo(-10, 5);
    expect(result.netPnl).toBeLessThan(-10);
  });

  it("computes profit for a SELL (short) trade", () => {
    const result = computePnl({
      side: "SELL",
      entryPrice: 100,
      exitPrice: 90,
      quantity: 1,
      commissionRate: 0.001,
      slippagePercent: 0,
    });
    expect(result.grossPnl).toBeCloseTo(10, 5); // 100-90
  });

  it("includes slippage cost", () => {
    const result = computePnl({
      side: "BUY",
      entryPrice: 100,
      exitPrice: 110,
      quantity: 2,
      commissionRate: 0.001,
      slippagePercent: 0.1, // 0.1%
    });
    expect(result.slippageCost).toBeCloseTo(0.2, 5); // 200 * 0.1%
  });

  it("handles zero quantity", () => {
    const result = computePnl({
      side: "BUY",
      entryPrice: 100,
      exitPrice: 110,
      quantity: 0,
      commissionRate: 0.001,
      slippagePercent: 0,
    });
    expect(result.grossPnl).toBe(0);
    expect(result.netPnl).toBe(0);
  });
});

describe("computeUnrealizedPnl", () => {
  it("positive for BUY when price goes up", () => {
    const pnl = computeUnrealizedPnl("BUY", 100, 110, 2);
    expect(pnl).toBeCloseTo(20, 5);
  });

  it("negative for BUY when price goes down", () => {
    const pnl = computeUnrealizedPnl("BUY", 100, 90, 2);
    expect(pnl).toBeCloseTo(-20, 5);
  });

  it("positive for SELL when price goes down", () => {
    const pnl = computeUnrealizedPnl("SELL", 100, 90, 2);
    expect(pnl).toBeCloseTo(20, 5);
  });
});

