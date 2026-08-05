import type { IndicatorInput } from "./indicators.js";
import { atr, ema, latestValue, macd } from "./indicators.js";
import { clamp } from "./rolling-normalization.js";
import { estimateTradingCosts, netEdgePercent, type CostEstimate } from "./cost-model.js";

export const DIRECTIONAL_FORMULA_VERSION = "m3-directional-v1";
export const DIRECTIONAL_FEATURE_VERSION = "m3-features-v1";

export type QuantitativeDirection = "LONG" | "SHORT" | "FLAT";

export interface DirectionalQuantitativeResult {
  asset: string;
  horizonCandles: number;
  opportunityIntensity: number;
  direction: QuantitativeDirection;
  directionScore: number;
  expectedMove: number;
  expectedRisk: number;
  estimatedCosts: CostEstimate;
  netEdge: number;
  features: Record<string, number | null>;
  formulaVersion: string;
  featureVersion: string;
  evaluatedAt: Date;
}

export interface DirectionalBaselineConfig {
  horizonCandles?: number;
  commissionRate?: number;
  spreadPercent?: number;
  slippagePercent?: number;
  expectedTurnover?: number;
  minNetEdgePercent?: number;
}

function signedMomentum(candles: IndicatorInput[], lookback: number): number {
  if (candles.length <= lookback) return 0;
  const previous = candles[candles.length - 1 - lookback]!.close;
  const current = candles[candles.length - 1]!.close;
  return previous > 0 ? (current - previous) / previous : 0;
}

function directionFromScore(score: number, threshold: number): QuantitativeDirection {
  if (score >= threshold) return "LONG";
  if (score <= -threshold) return "SHORT";
  return "FLAT";
}

export function scoreDirectionalBaseline(
  asset: string,
  candles: IndicatorInput[],
  config: DirectionalBaselineConfig = {},
): DirectionalQuantitativeResult {
  const horizonCandles = config.horizonCandles ?? 16;
  const notional = candles.at(-1)?.close ?? 0;
  const costs = estimateTradingCosts({
    notional,
    commissionRate: config.commissionRate ?? 0.001,
    spreadPercent: config.spreadPercent ?? 0.02,
    slippagePercent: config.slippagePercent ?? 0.05,
    expectedTurnover: config.expectedTurnover ?? 0.25,
  });

  const latestCandle = candles.at(-1);
  const close = latestCandle?.close ?? 0;
  const ema20 = latestValue(ema(candles, 20));
  const ema50 = latestValue(ema(candles, 50));
  const macdResult = macd(candles);
  const histogram = latestValue(macdResult.histogram);
  const atr14 = latestValue(atr(candles, 14));
  const momentum1h = signedMomentum(candles, 4);
  const momentum4h = signedMomentum(candles, 16);
  const signedTrend = ema20 !== null && ema50 !== null && close > 0 ? (ema20 - ema50) / close : 0;
  const signedBreakout = candles.length >= 21 && close > 0
    ? (close - Math.min(...candles.slice(-21, -1).map((c) => c.low))) /
      Math.max(close - Math.min(...candles.slice(-21, -1).map((c) => c.low)), 1e-12)
    : 0;

  const directionScore = clamp(
    signedTrend * 1200 + momentum1h * 600 + momentum4h * 300 + (histogram ?? 0) / Math.max(close, 1e-12) * 800 + (signedBreakout - 0.5) * 40,
    -100,
    100,
  );
  const expectedMove = Math.abs(momentum4h) * 100;
  const expectedRisk = close > 0 && atr14 !== null ? (atr14 / close) * 100 * Math.sqrt(Math.max(1, horizonCandles / 4)) : 0;
  const opportunityIntensity = clamp(Math.abs(directionScore) * 0.7 + expectedRisk * 5, 0, 100);
  const netEdge = netEdgePercent(expectedMove, expectedRisk, costs, notional);
  const minNetEdge = config.minNetEdgePercent ?? 0;
  const direction = netEdge > minNetEdge ? directionFromScore(directionScore, 15) : "FLAT";

  const available = candles.filter((c) => Number.isFinite(c.close) && c.close > 0);
  if (available.length < 50) {
    return {
      asset,
      horizonCandles,
      opportunityIntensity: 0,
      direction: "FLAT",
      directionScore: 0,
      expectedMove: 0,
      expectedRisk: 0,
      estimatedCosts: estimateTradingCosts({ notional: 0, commissionRate: 0, spreadPercent: 0, slippagePercent: 0, expectedTurnover: 0 }),
      netEdge: Number.NEGATIVE_INFINITY,
      features: {},
      formulaVersion: DIRECTIONAL_FORMULA_VERSION,
      featureVersion: DIRECTIONAL_FEATURE_VERSION,
      evaluatedAt: new Date(),
    };
  }

  return {
    asset,
    horizonCandles,
    opportunityIntensity,
    direction: direction,
    directionScore,
    expectedMove,
    expectedRisk,
    estimatedCosts: costs,
    netEdge,
    features: { signedTrend, momentum1h, momentum4h, histogram, atr14, signedBreakout },
    formulaVersion: DIRECTIONAL_FORMULA_VERSION,
    featureVersion: DIRECTIONAL_FEATURE_VERSION,
    evaluatedAt: new Date(),
  };
}
