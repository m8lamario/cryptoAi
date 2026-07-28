import type { BudgetConfig } from "./types.js";

interface SpendRecord {
  amountUsd: number;
  timestamp: number;
}

/**
 * Deterministic Budget Tracker.
 * Tracks AI spending with daily and monthly limits.
 */
export class BudgetTracker {
  private readonly config: BudgetConfig;
  private dailyRecords: SpendRecord[] = [];
  private monthlyRecords: SpendRecord[] = [];

  constructor(config: BudgetConfig) {
    this.config = config;
  }

  /** Check if a spend of `amountUsd` would exceed limits */
  canSpend(amountUsd: number): boolean {
    this.purgeExpired();
    const dailySpent = this.dailyRecords.reduce((sum, r) => sum + r.amountUsd, 0);
    const monthlySpent = this.monthlyRecords.reduce((sum, r) => sum + r.amountUsd, 0);

    if (dailySpent + amountUsd > this.config.maxDailyUsd) return false;
    if (monthlySpent + amountUsd > this.config.maxMonthlyUsd) return false;
    return true;
  }

  /** Record a spend */
  record(amountUsd: number): void {
    const record: SpendRecord = { amountUsd, timestamp: Date.now() };
    this.dailyRecords.push(record);
    this.monthlyRecords.push(record);
    this.purgeExpired();
  }

  /** Get current daily spend */
  getDailySpent(): number {
    this.purgeExpired();
    return this.dailyRecords.reduce((sum, r) => sum + r.amountUsd, 0);
  }

  /** Get current monthly spend */
  getMonthlySpent(): number {
    this.purgeExpired();
    return this.monthlyRecords.reduce((sum, r) => sum + r.amountUsd, 0);
  }

  /** Get remaining daily budget */
  getDailyRemaining(): number {
    return Math.max(0, this.config.maxDailyUsd - this.getDailySpent());
  }

  /** Get remaining monthly budget */
  getMonthlyRemaining(): number {
    return Math.max(0, this.config.maxMonthlyUsd - this.getMonthlySpent());
  }

  private purgeExpired(): void {
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    // Month start: first day of current UTC month
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    this.dailyRecords = this.dailyRecords.filter((r) => r.timestamp >= dayStartMs);
    this.monthlyRecords = this.monthlyRecords.filter((r) => r.timestamp >= monthStartMs);

    // Suppress unused variable warning
    void now;
  }
}

