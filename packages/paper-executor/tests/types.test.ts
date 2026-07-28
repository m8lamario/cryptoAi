import { describe, it, expect } from "vitest";
import type { BacktestConfig, BacktestMetrics } from "../src/backtest.js";

describe("BacktestMetrics type", () => {
  it("validates BacktestConfig shape", () => {
    const config: BacktestConfig = {
      strategy: "BUY_AND_HOLD",
      asset: "BTCUSDT",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      initialQuote: 10000,
      commissionRate: 0.001,
      slippagePercent: 0.05,
    };
    expect(config.strategy).toBe("BUY_AND_HOLD");
    expect(config.asset).toBe("BTCUSDT");
    expect(config.initialQuote).toBe(10000);
  });

  it("validates BacktestMetrics shape", () => {
    const metrics: BacktestMetrics = {
      strategy: "QUANTITATIVE",
      asset: "BTCUSDT",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-06-30T00:00:00.000Z",
      initialQuote: 10000,
      finalQuote: 10500,
      totalReturn: 5.0,
      maxDrawdown: 10.0,
      sharpeRatio: 1.5,
      sortinoRatio: 2.0,
      totalTrades: 25,
      winRate: 0.6,
      avgProfit: 150,
      avgLoss: 80,
      commissionCost: 25,
      slippageCost: 10,
      aiCostUsd: 0,
    };
    expect(metrics.totalReturn).toBe(5.0);
    expect(metrics.totalTrades).toBe(25);
    expect(metrics.sharpeRatio).toBe(1.5);
  });
});

describe("Executor types", () => {
  it("PaperExecutorConfig is well-formed", () => {
    const config = {
      initialBalance: 10000,
      commissionRate: 0.001,
      slippagePercent: 0.05,
      minPositionSize: 0.001,
    };
    expect(config.initialBalance).toBe(10000);
    expect(config.commissionRate).toBeLessThan(0.01);
  });
});

