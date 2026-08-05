import type { IndicatorInput } from "./indicators.js";

// ---------------------------------------------------------------------------
// M2 — Advanced scanner metrics: Funding Rate, Open Interest, Price Change
// ---------------------------------------------------------------------------

export interface AdvancedMetrics {
  symbol: string;
  fundingRate: number | null; // decimal (e.g. 0.0001 = 0.01%)
  openInterest: number | null; // USDT
  openInterestChange24h: number | null; // percent
  priceChange1h: number | null; // percent
  priceChange4h: number | null; // percent
  priceChange24h: number | null; // percent
}

/**
 * Score funding rate (0-100).
 * Extreme funding rates (very positive or very negative) suggest crowded positioning
 * and potential reversal opportunity.
 *
 * - Near-zero funding = low opportunity (neutral market)
 * - High positive or negative = high opportunity (potential squeeze/reversal)
 */
export function scoreFundingRate(fundingRate: number | null): number {
  if (fundingRate === null) return 0;
  // Normalize: 0.01% = 10, 0.05% = 50, 0.1%+ = 100
  const absRate = Math.abs(fundingRate);
  return Math.min(100, absRate * 100_000);
}

/**
 * Score open interest change (0-100).
 * Significant OI changes signal capital flowing in/out of the asset.
 * We can't compute 24h change with a single API call, so we score
 * the absolute value of OI as a proxy for market interest.
 *
 * Normalized: OI of 100M = 50, 200M+ = 100.
 */
export function scoreOpenInterest(
  openInterest: number | null,
  change24h: number | null = null,
): number {
  if (change24h !== null) {
    return Math.min(100, Math.abs(change24h) * 10);
  }
  if (openInterest === null) return 0;
  return Math.min(100, (openInterest / 200_000_000) * 100);
}

/**
 * Score price change (0-100).
 * Large price moves in any direction signal opportunity.
 * We aggregate absolute changes across 1h, 4h, and 24h timeframes.
 */
export function scorePriceChange(changes: {
  change1h: number | null;
  change4h: number | null;
  change24h: number | null;
}): number {
  const values = [changes.change1h, changes.change4h, changes.change24h]
    .filter((v): v is number => v !== null);

  if (values.length === 0) return 0;

  // Average absolute change across available timeframes
  const avgAbs = values.reduce((sum, v) => sum + Math.abs(v), 0) / values.length;
  // 1% = 25, 2% = 50, 4%+ = 100
  return Math.min(100, avgAbs * 25);
}

/**
 * Compute price change over N candles.
 * Returns percentage change from N candles ago to current close.
 */
export function computePriceChange(
  candles: IndicatorInput[],
  lookbackCandles: number,
): number | null {
  if (candles.length <= lookbackCandles) return null;
  const prevClose = candles[candles.length - 1 - lookbackCandles]?.close;
  const currentClose = candles[candles.length - 1]?.close;
  if (!prevClose || prevClose === 0 || !currentClose) return null;
  return ((currentClose - prevClose) / prevClose) * 100;
}
