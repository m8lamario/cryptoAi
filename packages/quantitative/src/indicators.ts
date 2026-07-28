import { z } from "zod";

/** A single price candle used for indicator calculations */
export const IndicatorInputSchema = z.object({
  openTime: z.number(),
  close: z.number(),
  high: z.number(),
  low: z.number(),
  volume: z.number(),
});

export type IndicatorInput = z.infer<typeof IndicatorInputSchema>;

/**
 * Simple Moving Average.
 * Returns null if not enough data points.
 */
export function sma(candles: IndicatorInput[], period: number): (number | null)[] {
  if (period <= 0 || candles.length === 0) return candles.map(() => null);

  const result: (number | null)[] = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i]!.close;
    if (i >= period) {
      sum -= candles[i - period]!.close;
    }
    result.push(i >= period - 1 ? sum / period : null);
  }

  return result;
}

/**
 * Exponential Moving Average.
 * Uses SMA for the first EMA seed value.
 */
export function ema(candles: IndicatorInput[], period: number): (number | null)[] {
  if (period <= 0 || candles.length === 0) return candles.map(() => null);

  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  // Seed with SMA
  const smaValues = sma(candles, period);
  let prevEma: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    const smaVal = smaValues[i];
    if (smaVal === null || smaVal === undefined) {
      result.push(null);
      continue;
    }

    if (prevEma === null) {
      prevEma = smaVal;
    } else {
      prevEma = (candles[i]!.close - prevEma) * multiplier + prevEma;
    }
    result.push(prevEma);
  }

  return result;
}

/**
 * Relative Strength Index (RSI).
 * Uses Wilder's smoothing method.
 * Default period is 14.
 */
export function rsi(candles: IndicatorInput[], period: number = 14): (number | null)[] {
  if (period <= 0 || candles.length < period + 1) return candles.map(() => null);

  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const change = candles[i]!.close - candles[i - 1]!.close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First RSI value uses simple average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Before we have enough data, return null
  for (let i = 0; i < period; i++) {
    result.push(null);
  }

  for (let i = period; i < gains.length; i++) {
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }

    // Wilder's smoothing
    avgGain = (avgGain * (period - 1) + gains[i]!) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]!) / period;
  }

  // Push one more null for the last candle (RSI is shifted by 1 vs gains array)
  result.push(null);

  return result;
}

/**
 * MACD result: { macd, signal, histogram }
 * MACD = EMA(12) - EMA(26)
 * Signal = EMA(9) of MACD
 * Histogram = MACD - Signal
 */
export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(
  candles: IndicatorInput[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MacdResult {
  if (candles.length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }

  const emaFast = ema(candles, fastPeriod);
  const emaSlow = ema(candles, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    }
  }

  // Compute signal line: EMA(9) of MACD
  // We need to convert MACD values to IndicatorInput-like structure for EMA
  const macdAsCandles = macdLine
    .filter((v) => v !== null)
    .map((v) => ({
      openTime: 0,
      close: v as number,
      high: v as number,
      low: v as number,
      volume: 0,
    }));

  const signalRaw = ema(macdAsCandles, signalPeriod);

  // Map back signal to the original candle array positions
  const signalLine: (number | null)[] = [];
  let signalIdx = 0;
  for (const m of macdLine) {
    if (m === null) {
      signalLine.push(null);
    } else {
      signalLine.push(signalRaw[signalIdx] ?? null);
      signalIdx++;
    }
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i]! - signalLine[i]!);
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Average True Range (ATR).
 * Uses Wilder's smoothing (same as RSI).
 */
export function atr(candles: IndicatorInput[], period: number = 14): (number | null)[] {
  if (period <= 0 || candles.length < period + 1) return candles.map(() => null);

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i]!.high;
    const low = candles[i]!.low;
    const prevClose = candles[i - 1]!.close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  const result: (number | null)[] = [];
  // First value is null (no previous candle for TR)
  result.push(null);

  // Initial ATR is simple average
  let atrValue = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = 0; i < Math.min(period, trueRanges.length); i++) {
    result.push(null);
  }

  for (let i = period; i < trueRanges.length; i++) {
    atrValue = (atrValue * (period - 1) + trueRanges[i]!) / period;
    result.push(atrValue);
  }

  // Pad to match candle length
  while (result.length < candles.length) {
    result.push(null);
  }

  return result;
}

/**
 * Historical volatility.
 * Computes the standard deviation of logarithmic returns over the given period.
 * Annualized by multiplying by sqrt(365 * 24 * 4) for 15-min candles.
 */
export function volatility(candles: IndicatorInput[], period: number = 20): (number | null)[] {
  if (period <= 0 || candles.length < period + 1) return candles.map(() => null);

  const logReturns: (number | null)[] = [];
  logReturns.push(null); // first candle has no previous close
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1]!.close;
    if (prevClose <= 0) {
      logReturns.push(null);
    } else {
      logReturns.push(Math.log(candles[i]!.close / prevClose));
    }
  }

  const result: (number | null)[] = [];
  // Number of 15-min candles in a year: 365 * 24 * 4 = 35040
  const annualizationFactor = Math.sqrt(35040);

  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }

    const window = logReturns.slice(i - period + 1, i + 1).filter(
      (v): v is number => v !== null,
    );
    if (window.length < 2) {
      result.push(null);
      continue;
    }

    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance =
      window.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (window.length - 1);
    result.push(Math.sqrt(variance) * annualizationFactor);
  }

  return result;
}

/** Computes the latest indicator value (last non-null) from an array. */
export function latestValue(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const val = values[i];
    if (val !== null && val !== undefined) return val;
  }
  return null;
}
