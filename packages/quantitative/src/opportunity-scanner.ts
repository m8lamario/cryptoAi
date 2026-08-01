import type { IndicatorInput } from "./indicators.js";
import { ema, rsi, macd, volatility, latestValue } from "./indicators.js";
import type { AdvancedMetrics } from "./advanced-scanner.js";
import {
  scoreFundingRate,
  scoreOpenInterest,
  scorePriceChange,
  computePriceChange,
} from "./advanced-scanner.js";

// --- Market Opportunity Scanner — v1.5 M2 with advanced metrics ---

/** Individual score component */
export interface OpportunityComponent {
  name: string;
  value: number; // 0-100
  weight: number; // 0-1
}

/** Result of a single asset scan */
export interface OpportunityScanResult {
  asset: string;
  score: number; // 0-100 weighted sum
  classification:
    | "IGNORE"
    | "MONITORING"
    | "QUANTITATIVE_ANALYSIS"
    | "AI_ANALYSIS"
    | "MAX_PRIORITY";
  components: OpportunityComponent[];
  evaluatedAt: Date;
}

/** Configurable weights for each component — M2: recalibrated with 9 metrics */
export interface ScannerWeights {
  rsi: number;
  macd: number;
  volatility: number;
  volume: number;
  trend: number;
  breakout: number;
  fundingRate: number;
  openInterest: number;
  priceChange: number;
  /** Threshold to trigger AI analysis (0-100) */
  aiTriggerThreshold: number;
}

export const DEFAULT_SCANNER_WEIGHTS: ScannerWeights = {
  rsi: 0.18,
  macd: 0.18,
  volatility: 0.12,
  volume: 0.12,
  trend: 0.15,
  breakout: 0.10,
  fundingRate: 0.05,
  openInterest: 0.05,
  priceChange: 0.05,
  aiTriggerThreshold: 60,
};

// ---- Private scoring functions ----

function _scoreRsi(rsiValue: number | null): number {
  if (rsiValue === null) return 0;
  const distance = Math.abs(rsiValue - 50);
  return Math.min(100, (distance / 50) * 100);
}

function _scoreMacd(macdValue: number | null, signalValue: number | null, histogram: number | null): number {
  if (macdValue === null || signalValue === null || histogram === null) return 0;
  const denominator = Math.abs(signalValue) + 1e-8;
  const ratio = Math.abs(histogram) / denominator;
  return Math.min(100, ratio * 200);
}

function _scoreVolatility(volValue: number | null): number {
  if (volValue === null) return 0;
  return Math.min(100, (volValue / 1.5) * 100);
}

function _scoreVolume(candles: IndicatorInput[]): number {
  if (candles.length < 20) return 0;
  const volumes = candles.map((c) => c.volume);
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (avgVolume <= 0) return 0;
  const ratio = currentVolume / avgVolume;
  return Math.min(100, Math.max(0, (ratio - 1) * 100));
}

function _scoreTrend(candles: IndicatorInput[]): number {
  if (candles.length < 50) return 0;
  const ema20 = ema(candles, 20);
  const ema50 = ema(candles, 50);
  const currentEma20 = latestValue(ema20);
  const currentEma50 = latestValue(ema50);
  if (currentEma20 === null || currentEma50 === null) return 0;
  const close = candles[candles.length - 1]!.close;
  const gap = Math.abs(currentEma20 - currentEma50) / close;
  return Math.min(100, gap * 2500);
}

function _scoreBreakout(candles: IndicatorInput[]): number {
  if (candles.length < 20) return 0;
  const recentHigh = Math.max(...candles.slice(-20).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-20).map((c) => c.low));
  const currentClose = candles[candles.length - 1]!.close;
  if (recentHigh <= recentLow) return 0;
  const range = recentHigh - recentLow;
  const position = (currentClose - recentLow) / range;
  const distance = Math.abs(position - 0.5) * 2;
  return Math.min(100, distance * 100);
}

/**
 * Classify opportunity score.
 * 0-30: IGNORE / 30-60: MONITORING / 60-80: QUANTITATIVE_ANALYSIS / 80-100: AI_ANALYSIS
 */
function _classify(score: number): OpportunityScanResult["classification"] {
  if (score <= 30) return "IGNORE";
  if (score <= 60) return "MONITORING";
  if (score <= 80) return "QUANTITATIVE_ANALYSIS";
  return "AI_ANALYSIS";
}

// ---- Public API ----

/**
 * Deterministic Market Opportunity Scanner.
 *
 * Pure function: no IO, no side effects, no randomness.
 *
 * @param advanced Optional futures/sentiment metrics (funding rate, OI).
 *                 Price changes are computed from candles automatically.
 */
export function scanOpportunity(
  asset: string,
  candles: IndicatorInput[],
  weights: Partial<ScannerWeights> = {},
  advanced?: Partial<AdvancedMetrics>,
): OpportunityScanResult {
  const w = { ...DEFAULT_SCANNER_WEIGHTS, ...weights };

  if (candles.length < 50) {
    return { asset, score: 0, classification: "IGNORE", components: [], evaluatedAt: new Date() };
  }

  // Core indicators
  const currentRsi = latestValue(rsi(candles, 14));
  const { macd: macdLine, signal: sigLine, histogram: histLine } = macd(candles, 12, 26, 9);
  const currentVol = latestValue(volatility(candles, 20));

  // M2 advanced metrics
  const change1h = computePriceChange(candles, 4);
  const change4h = computePriceChange(candles, 16);
  const change24h = computePriceChange(candles, 96);
  const pcScore = scorePriceChange({ change1h, change4h: change4h ?? change1h, change24h });
  const frScore = scoreFundingRate(advanced?.fundingRate ?? null);
  const oiScore = scoreOpenInterest(advanced?.openInterest ?? null);

  const components: OpportunityComponent[] = [
    { name: "RSI", value: _scoreRsi(currentRsi), weight: w.rsi },
    { name: "MACD", value: _scoreMacd(latestValue(macdLine), latestValue(sigLine), latestValue(histLine)), weight: w.macd },
    { name: "Volatility", value: _scoreVolatility(currentVol), weight: w.volatility },
    { name: "Volume", value: _scoreVolume(candles), weight: w.volume },
    { name: "Trend", value: _scoreTrend(candles), weight: w.trend },
    { name: "Breakout", value: _scoreBreakout(candles), weight: w.breakout },
    { name: "Funding Rate", value: frScore, weight: w.fundingRate },
    { name: "Open Interest", value: oiScore, weight: w.openInterest },
    { name: "Price Change", value: pcScore, weight: w.priceChange },
  ];

  const weightedScore = components.reduce((sum, c) => sum + c.value * c.weight, 0);

  return {
    asset,
    score: Math.round(weightedScore),
    classification: _classify(weightedScore),
    components,
    evaluatedAt: new Date(),
  };
}

/**
 * Scan all assets and return results.
 */
export function scanAllAssets(
  assets: { symbol: string }[],
  candlesByAsset: Map<string, IndicatorInput[]>,
  weights?: Partial<ScannerWeights>,
  advancedByAsset?: Map<string, Partial<AdvancedMetrics>>,
): OpportunityScanResult[] {
  return assets.map((a) => {
    const candles = candlesByAsset.get(a.symbol) ?? [];
    const advanced = advancedByAsset?.get(a.symbol);
    return scanOpportunity(a.symbol, candles, weights, advanced);
  });
}
