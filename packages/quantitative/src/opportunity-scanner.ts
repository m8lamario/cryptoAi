import type { IndicatorInput } from "./indicators.js";
import { sma, ema, rsi, macd, atr, volatility, latestValue } from "./indicators.js";

// --- Market Opportunity Scanner — matches ProjectPlan v1.4 Section 4 ---

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
  classification: "IGNORE" | "MONITORING" | "AI_ANALYSIS" | "MAX_PRIORITY";
  components: OpportunityComponent[];
  evaluatedAt: Date;
}

/** Configurable weights for each component */
export interface ScannerWeights {
  rsi: number;
  macd: number;
  volatility: number;
  volume: number;
  trend: number;
  breakout: number;
  /** Threshold to trigger AI analysis (0-100) */
  aiTriggerThreshold: number;
}

export const DEFAULT_SCANNER_WEIGHTS: ScannerWeights = {
  rsi: 0.20,
  macd: 0.20,
  volatility: 0.15,
  volume: 0.15,
  trend: 0.20,
  breakout: 0.10,
  aiTriggerThreshold: 60,
};

/**
 * Score RSI component (0-100).
 * RSI near 30 (oversold) or 70 (overbought) = high opportunity.
 * RSI near 50 = low opportunity.
 */
function scoreRsi(rsiValue: number | null): number {
  if (rsiValue === null) return 0;
  // Distance from 50, scaled. Max at 0 or 100.
  const distance = Math.abs(rsiValue - 50);
  return Math.min(100, (distance / 50) * 100);
}

/**
 * Score MACD component (0-100).
 * Strong histogram divergence = high opportunity.
 */
function scoreMacd(macdValue: number | null, signalValue: number | null, histogram: number | null): number {
  if (macdValue === null || signalValue === null || histogram === null) return 0;

  // Histogram strength relative to price is hard to normalize without price.
  // We use the ratio of histogram to signal as a relative measure.
  const denominator = Math.abs(signalValue) + 1e-8;
  const ratio = Math.abs(histogram) / denominator;
  return Math.min(100, ratio * 200);
}

/**
 * Score volatility component (0-100).
 * Higher volatility = more opportunity.
 * Normalized: annualized vol of 0.5 = 50, 1.0 = 100.
 */
function scoreVolatility(volValue: number | null): number {
  if (volValue === null) return 0;
  // Annualized volatility, cap at 1.5 (150%)
  return Math.min(100, (volValue / 1.5) * 100);
}

/**
 * Score volume component (0-100).
 * Current volume vs SMA of volume.
 */
function scoreVolume(candles: IndicatorInput[]): number {
  if (candles.length < 20) return 0;

  const volumes = candles.map((c) => c.volume);
  const currentVolume = volumes[volumes.length - 1] ?? 0;
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

  if (avgVolume <= 0) return 0;
  const ratio = currentVolume / avgVolume;
  // 1.0x = 0, 1.5x = 50, 2x = 100
  return Math.min(100, Math.max(0, (ratio - 1) * 100));
}

/**
 * Score trend component (0-100).
 * EMA crossover strength and alignment.
 * Strong directional alignment (EMA20 vs EMA50 gap) = high opportunity.
 */
function scoreTrend(candles: IndicatorInput[]): number {
  if (candles.length < 50) return 0;

  const ema20 = ema(candles, 20);
  const ema50 = ema(candles, 50);
  const currentEma20 = latestValue(ema20);
  const currentEma50 = latestValue(ema50);

  if (currentEma20 === null || currentEma50 === null) return 0;

  const close = candles[candles.length - 1]!.close;
  const gap = Math.abs(currentEma20 - currentEma50) / close;

  // Gap of 1% = 25, 2% = 50, 4% = 100
  return Math.min(100, gap * 2500);
}

/**
 * Score breakout component (0-100).
 * Current price vs recent high/low range.
 * Price near the edge of the recent range = potential breakout.
 */
function scoreBreakout(candles: IndicatorInput[]): number {
  if (candles.length < 20) return 0;

  const recentHigh = Math.max(...candles.slice(-20).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-20).map((c) => c.low));
  const currentClose = candles[candles.length - 1]!.close;

  if (recentHigh <= recentLow) return 0;

  const range = recentHigh - recentLow;
  // How close to the top (1 = at high, 0 = at low)
  const position = (currentClose - recentLow) / range;
  // Distance from middle (0.5 = no breakout, 0 or 1 = strong breakout)
  const distance = Math.abs(position - 0.5) * 2;
  return Math.min(100, distance * 100);
}

/**
 * Classify opportunity score into a bucket.
 * 0-30: IGNORE
 * 30-60: MONITORING
 * 60-80: AI_ANALYSIS → trigger AI
 * 80-100: MAX_PRIORITY → trigger AI immediately
 */
function classify(score: number): OpportunityScanResult["classification"] {
  if (score <= 30) return "IGNORE";
  if (score <= 60) return "MONITORING";
  if (score <= 80) return "AI_ANALYSIS";
  return "MAX_PRIORITY";
}

/**
 * Deterministic Market Opportunity Scanner.
 *
 * Evaluates current market conditions for a single asset and produces a 0-100 score.
 * This is a pure function: no IO, no side effects, no randomness.
 *
 * Used by the MarketScanner job to decide whether to trigger the AI pipeline.
 */
export function scanOpportunity(
  asset: string,
  candles: IndicatorInput[],
  weights: Partial<ScannerWeights> = {},
): OpportunityScanResult {
  const w = { ...DEFAULT_SCANNER_WEIGHTS, ...weights };

  if (candles.length < 50) {
    // Not enough data — return minimal score
    return {
      asset,
      score: 0,
      classification: "IGNORE",
      components: [],
      evaluatedAt: new Date(),
    };
  }

  // Compute indicators
  const rsiValues = rsi(candles, 14);
  const currentRsi = latestValue(rsiValues);

  const macdResult = macd(candles, 12, 26, 9);
  const currentMacd = latestValue(macdResult.macd);
  const currentMacdSignal = latestValue(macdResult.signal);
  const currentHistogram = latestValue(macdResult.histogram);

  const volValues = volatility(candles, 20);
  const currentVol = latestValue(volValues);

  // Score each component
  const rsiScore = scoreRsi(currentRsi);
  const macdScore = scoreMacd(currentMacd, currentMacdSignal, currentHistogram);
  const volScore = scoreVolatility(currentVol);
  const volumeScore = scoreVolume(candles);
  const trendScore = scoreTrend(candles);
  const breakoutScore = scoreBreakout(candles);

  const components: OpportunityComponent[] = [
    { name: "RSI", value: rsiScore, weight: w.rsi },
    { name: "MACD", value: macdScore, weight: w.macd },
    { name: "Volatility", value: volScore, weight: w.volatility },
    { name: "Volume", value: volumeScore, weight: w.volume },
    { name: "Trend", value: trendScore, weight: w.trend },
    { name: "Breakout", value: breakoutScore, weight: w.breakout },
  ];

  // Weighted sum
  const weightedScore = components.reduce(
    (sum, c) => sum + c.value * c.weight,
    0,
  );

  return {
    asset,
    score: Math.round(weightedScore),
    classification: classify(weightedScore),
    components,
    evaluatedAt: new Date(),
  };
}

/**
 * Scan all supported assets and return results.
 * Assets with score >= threshold should trigger the AI pipeline.
 */
export function scanAllAssets(
  assets: { symbol: string }[],
  candlesByAsset: Map<string, IndicatorInput[]>,
  weights?: Partial<ScannerWeights>,
): OpportunityScanResult[] {
  return assets.map((a) => {
    const candles = candlesByAsset.get(a.symbol) ?? [];
    return scanOpportunity(a.symbol, candles, weights);
  });
}
