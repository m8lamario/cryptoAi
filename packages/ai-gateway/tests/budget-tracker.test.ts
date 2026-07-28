import { describe, it, expect } from "vitest";
import { BudgetTracker } from "../src/budget-tracker.js";

describe("BudgetTracker", () => {
  const config = {
    maxDailyUsd: 1.0,
    maxMonthlyUsd: 10.0,
  };

  it("allows spending within budget", () => {
    const bt = new BudgetTracker(config);
    expect(bt.canSpend(0.5)).toBe(true);
  });

  it("blocks spending exceeding daily budget", () => {
    const bt = new BudgetTracker(config);
    bt.record(0.9);
    expect(bt.canSpend(0.2)).toBe(false); // 0.9 + 0.2 > 1.0
  });

  it("blocks spending exceeding monthly budget", () => {
    const bt = new BudgetTracker(config);
    bt.record(9.5);
    expect(bt.canSpend(1.0)).toBe(false); // 9.5 + 1.0 > 10.0
  });

  it("tracks daily and monthly spends separately", () => {
    const bt = new BudgetTracker(config);
    bt.record(0.3);
    bt.record(0.4);

    expect(bt.getDailySpent()).toBeCloseTo(0.7, 5);
    expect(bt.getMonthlySpent()).toBeCloseTo(0.7, 5);
  });

  it("returns remaining budget", () => {
    const bt = new BudgetTracker(config);
    bt.record(0.3);

    expect(bt.getDailyRemaining()).toBeCloseTo(0.7, 5);
    expect(bt.getMonthlyRemaining()).toBeCloseTo(9.7, 5);
  });

  it("can spend exactly at the limit", () => {
    const bt = new BudgetTracker(config);
    // Daily limit: 1.0, Monthly limit: 10.0
    expect(bt.canSpend(0.99)).toBe(true);
    bt.record(0.99);
    expect(bt.canSpend(0.01)).toBe(true); // 0.99+0.01 = 1.0, exactly daily
    bt.record(0.01);
    expect(bt.getDailySpent()).toBeCloseTo(1.0, 5);
    expect(bt.canSpend(0.0001)).toBe(false); // daily exceeded
  });
});
