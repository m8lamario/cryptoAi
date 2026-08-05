import { atr, ema, latestValue, macd, rsi, sma, volatility } from "@cryptoai/quantitative";

export interface FrozenCandle {
  openTime: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function computeQuantitativeSignal(candles: FrozenCandle[]) {
  const inputs = candles.map(({ openTime, close, high, low, volume }) => ({ openTime, close, high, low, volume }));
  const macdResult = macd(inputs);
  return {
    sma20: latestValue(sma(inputs, 20)), sma50: latestValue(sma(inputs, 50)), ema20: latestValue(ema(inputs, 20)),
    rsi14: latestValue(rsi(inputs, 14)), macd: latestValue(macdResult.macd), macdSignal: latestValue(macdResult.signal),
    macdHistogram: latestValue(macdResult.histogram), atr14: latestValue(atr(inputs, 14)), volatility: latestValue(volatility(inputs, 20)),
  };
}

