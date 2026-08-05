import { scoreDirectionalBaseline, type IndicatorInput } from "@cryptoai/quantitative";

export type EvaluationStrategy = "BUY_AND_HOLD" | "QUANTITATIVE" | "HYBRID_AI";
export type FoldRole = "TRAIN" | "VALIDATION" | "TEST";
export type MarketRegime = "TRENDING_UP" | "TRENDING_DOWN" | "HIGH_VOLATILITY" | "LOW_VOLATILITY" | "UNAVAILABLE";

export interface EvaluationCandle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WalkForwardConfig {
  asset: string;
  candles: EvaluationCandle[];
  initialQuote: number;
  trainCandles: number;
  validationCandles: number;
  testCandles: number;
  stepCandles?: number;
  commissionRate: number;
  spreadPercent: number;
  slippagePercent: number;
  executionPolicy?: "NO_EXECUTION";
  formulaVersion?: string;
  featureVersion?: string;
  aiSignal?: (input: { asset: string; asOf: number; candles: EvaluationCandle[] }) => "LONG" | "FLAT";
}

export interface EvaluationMetrics {
  strategy: EvaluationStrategy;
  asset: string;
  initialQuote: number;
  finalQuote: number;
  netReturnPercent: number;
  annualizedReturnPercent: number;
  volatilityPercent: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdownPercent: number;
  turnover: number;
  exposureTimePercent: number;
  totalTrades: number;
  hitRate: number | null;
  profitFactor: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  commissionCost: number;
  spreadCost: number;
  slippageCost: number;
  aiCostUsd: number;
  regimeReturns: Record<MarketRegime, number>;
  outOfSample: boolean;
}

export interface WalkForwardFold {
  fold: number;
  trainStart: number;
  trainEnd: number;
  validationStart: number;
  validationEnd: number;
  testStart: number;
  testEnd: number;
  metrics: Record<EvaluationStrategy, EvaluationMetrics>;
}

export interface WalkForwardResult {
  asset: string;
  folds: WalkForwardFold[];
  testMetrics: Record<EvaluationStrategy, EvaluationMetrics>;
  decision: "GO" | "NO_GO" | "HOLD";
  decisionReason: string;
  executionPolicy: "NO_EXECUTION";
}

function regime(candles: EvaluationCandle[], index: number): MarketRegime {
  if (index < 20) return "UNAVAILABLE";
  const window = candles.slice(Math.max(0, index - 19), index + 1);
  const first = window[0]?.close ?? 0;
  const last = window.at(-1)?.close ?? 0;
  if (first <= 0 || last <= 0) return "UNAVAILABLE";
  const returns = window.slice(1).map((c, i) => c.close / window[i]!.close - 1);
  const volatility = Math.sqrt(returns.reduce((sum, value) => sum + value ** 2, 0) / returns.length);
  if (volatility > 0.02) return "HIGH_VOLATILITY";
  if (last / first > 1.01) return "TRENDING_UP";
  if (last / first < 0.99) return "TRENDING_DOWN";
  return "LOW_VOLATILITY";
}

function cost(notional: number, config: WalkForwardConfig): { commission: number; spread: number; slippage: number; total: number } {
  const commission = notional * Math.max(0, config.commissionRate);
  const spread = notional * Math.max(0, config.spreadPercent) / 100;
  const slippage = notional * Math.max(0, config.slippagePercent) / 100;
  return { commission, spread, slippage, total: commission + spread + slippage };
}

function emptyMetrics(strategy: EvaluationStrategy, asset: string, initialQuote: number, outOfSample: boolean): EvaluationMetrics {
  return { strategy, asset, initialQuote, finalQuote: initialQuote, netReturnPercent: 0, annualizedReturnPercent: 0, volatilityPercent: 0, sharpeRatio: null, sortinoRatio: null, maxDrawdownPercent: 0, turnover: 0, exposureTimePercent: 0, totalTrades: 0, hitRate: null, profitFactor: null, averageWin: null, averageLoss: null, commissionCost: 0, spreadCost: 0, slippageCost: 0, aiCostUsd: 0, regimeReturns: { TRENDING_UP: 0, TRENDING_DOWN: 0, HIGH_VOLATILITY: 0, LOW_VOLATILITY: 0, UNAVAILABLE: 0 }, outOfSample };
}

function simulate(strategy: EvaluationStrategy, config: WalkForwardConfig, candles: EvaluationCandle[], outOfSample: boolean): EvaluationMetrics {
  if (candles.length < 2) return emptyMetrics(strategy, config.asset, config.initialQuote, outOfSample);
  let cash = config.initialQuote;
  let quantity = 0;
  let entryValue = 0;
  let commissionCost = 0;
  let spreadCost = 0;
  let slippageCost = 0;
  let turnover = 0;
  let exposureBars = 0;
  const equity: number[] = [];
  const tradePnl: number[] = [];
  const regimeEquity = new Map<MarketRegime, { start: number; end: number }>();
  const shouldLong = (index: number): boolean => {
    if (strategy === "BUY_AND_HOLD") return true;
    const history = candles.slice(0, index + 1);
    if (history.length < 50) return false;
    if (strategy === "HYBRID_AI") return config.aiSignal?.({ asset: config.asset, asOf: candles[index]!.closeTime, candles: history }) === "LONG";
    const inputs: IndicatorInput[] = history.map((c) => ({ openTime: c.openTime, high: c.high, low: c.low, close: c.close, volume: c.volume }));
    return scoreDirectionalBaseline(config.asset, inputs).direction === "LONG";
  };

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]!;
    const targetLong = shouldLong(i);
    if (targetLong && quantity === 0 && candle.open > 0) {
      const tradingCost = cost(cash, config);
      const notional = Math.max(0, cash - tradingCost.total);
      quantity = notional / candle.open;
      entryValue = notional;
      cash = 0;
      commissionCost += tradingCost.commission;
      spreadCost += tradingCost.spread;
      slippageCost += tradingCost.slippage;
      turnover += notional;
    } else if (!targetLong && quantity > 0) {
      const notional = quantity * candle.open;
      const tradingCost = cost(notional, config);
      cash = notional - tradingCost.total;
      tradePnl.push(cash - entryValue);
      commissionCost += tradingCost.commission;
      spreadCost += tradingCost.spread;
      slippageCost += tradingCost.slippage;
      turnover += notional;
      quantity = 0;
      entryValue = 0;
    }
    if (quantity > 0) exposureBars++;
    const value = cash + quantity * candle.close;
    equity.push(value);
    const currentRegime = regime(candles, i);
    const previous = regimeEquity.get(currentRegime);
    regimeEquity.set(currentRegime, { start: previous?.start ?? value, end: value });
  }
  if (quantity > 0) {
    const finalCandle = candles.at(-1)!;
    const notional = quantity * finalCandle.close;
    const tradingCost = cost(notional, config);
    cash = notional - tradingCost.total;
    tradePnl.push(cash - entryValue);
    commissionCost += tradingCost.commission;
    spreadCost += tradingCost.spread;
    slippageCost += tradingCost.slippage;
    turnover += notional;
  }
  const finalQuote = cash;
  const returns = equity.slice(1).map((value, i) => equity[i]! > 0 ? value / equity[i]! - 1 : 0);
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1 ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1) : 0;
  const downside = returns.filter((r) => r < 0);
  const downsideDeviation = downside.length ? Math.sqrt(downside.reduce((s, r) => s + r ** 2, 0) / downside.length) : 0;
  let peak = config.initialQuote;
  let maxDrawdown = 0;
  for (const value of equity) { peak = Math.max(peak, value); maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - value) / peak : 0); }
  const wins = tradePnl.filter((pnl) => pnl > 0);
  const losses = tradePnl.filter((pnl) => pnl < 0);
  const regimeReturns = { TRENDING_UP: 0, TRENDING_DOWN: 0, HIGH_VOLATILITY: 0, LOW_VOLATILITY: 0, UNAVAILABLE: 0 } as Record<MarketRegime, number>;
  for (const [key, value] of regimeEquity) regimeReturns[key] = value.start > 0 ? (value.end - value.start) / value.start * 100 : 0;
  const days = Math.max(1 / 24, (candles.at(-1)!.closeTime - candles[0]!.openTime) / 86_400_000);
  return { strategy, asset: config.asset, initialQuote: config.initialQuote, finalQuote, netReturnPercent: config.initialQuote > 0 ? (finalQuote - config.initialQuote) / config.initialQuote * 100 : 0, annualizedReturnPercent: config.initialQuote > 0 ? ((finalQuote / config.initialQuote) ** (365 / days) - 1) * 100 : 0, volatilityPercent: Math.sqrt(variance) * Math.sqrt(365) * 100, sharpeRatio: variance > 0 ? mean / Math.sqrt(variance) * Math.sqrt(365) : null, sortinoRatio: downsideDeviation > 0 ? mean / downsideDeviation * Math.sqrt(365) : null, maxDrawdownPercent: maxDrawdown * 100, turnover: config.initialQuote > 0 ? turnover / config.initialQuote : 0, exposureTimePercent: exposureBars / candles.length * 100, totalTrades: tradePnl.length, hitRate: tradePnl.length ? wins.length / tradePnl.length : null, profitFactor: losses.length ? wins.reduce((s, p) => s + p, 0) / Math.abs(losses.reduce((s, p) => s + p, 0)) : null, averageWin: wins.length ? wins.reduce((s, p) => s + p, 0) / wins.length : null, averageLoss: losses.length ? Math.abs(losses.reduce((s, p) => s + p, 0)) / losses.length : null, commissionCost, spreadCost, slippageCost, aiCostUsd: 0, regimeReturns, outOfSample };
}

export function runWalkForward(config: WalkForwardConfig): WalkForwardResult {
  if (config.executionPolicy !== "NO_EXECUTION") throw new Error("M9 requires NO_EXECUTION");
  const candles = [...config.candles].sort((a, b) => a.openTime - b.openTime);
  const step = config.stepCandles ?? config.testCandles;
  const folds: WalkForwardFold[] = [];
  for (let start = 0, fold = 0; start + config.trainCandles + config.validationCandles + config.testCandles <= candles.length; start += step, fold++) {
    const trainStart = start;
    const validationStart = start + config.trainCandles;
    const testStart = validationStart + config.validationCandles;
    const testEnd = testStart + config.testCandles;
    const test = candles.slice(testStart, testEnd);
    const metrics = { BUY_AND_HOLD: simulate("BUY_AND_HOLD", { ...config, initialQuote: config.initialQuote, candles: test }, test, true), QUANTITATIVE: simulate("QUANTITATIVE", { ...config, initialQuote: config.initialQuote, candles: candles.slice(start, testEnd) }, test, true), HYBRID_AI: simulate("HYBRID_AI", { ...config, initialQuote: config.initialQuote, candles: candles.slice(start, testEnd) }, test, true) };
    folds.push({ fold, trainStart: candles[trainStart]!.openTime, trainEnd: candles[validationStart - 1]!.closeTime, validationStart: candles[validationStart]!.openTime, validationEnd: candles[testStart - 1]!.closeTime, testStart: candles[testStart]!.openTime, testEnd: candles[testEnd - 1]!.closeTime, metrics });
  }
  if (!folds.length) throw new Error("Insufficient candles for walk-forward folds");
  const aggregate = (strategy: EvaluationStrategy): EvaluationMetrics => {
    const values = folds.map((fold) => fold.metrics[strategy]);
    const result = { ...values[0]! };
    result.finalQuote = values.reduce((sum, value) => sum + value.finalQuote, 0) / values.length;
    result.netReturnPercent = values.reduce((sum, value) => sum + value.netReturnPercent, 0) / values.length;
    result.maxDrawdownPercent = Math.max(...values.map((value) => value.maxDrawdownPercent));
    result.totalTrades = values.reduce((sum, value) => sum + value.totalTrades, 0);
    result.outOfSample = true;
    return result;
  };
  const testMetrics = { BUY_AND_HOLD: aggregate("BUY_AND_HOLD"), QUANTITATIVE: aggregate("QUANTITATIVE"), HYBRID_AI: aggregate("HYBRID_AI") };
  const quantitative = testMetrics.QUANTITATIVE;
  const hybrid = testMetrics.HYBRID_AI;
  const improved = hybrid.netReturnPercent > quantitative.netReturnPercent && hybrid.maxDrawdownPercent <= quantitative.maxDrawdownPercent;
  return { asset: config.asset, folds, testMetrics, decision: improved ? "GO" : "HOLD", decisionReason: improved ? "Hybrid AI improved out-of-sample return without increasing drawdown." : "AI overlay did not demonstrate a superior risk-adjusted out-of-sample result.", executionPolicy: "NO_EXECUTION" };
}

