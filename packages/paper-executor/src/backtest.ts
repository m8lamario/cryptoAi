import { prisma } from "@cryptoai/database";
import type { PriceCandle } from "@cryptoai/database";
import { computePnl } from "@cryptoai/quantitative";

/**
 * Phase 7 — Backtester.
 *
 * Walk-forward backtesting with look-ahead bias prevention.
 * Three strategies:
 * 1. BUY_AND_HOLD — benchmark
 * 2. QUANTITATIVE — simple SMA crossover bot (no AI)
 * 3. HYBRID_AI — full AI pipeline results (from StoredAgentReport + StoredTradeProposal)
 */

export interface BacktestConfig {
  strategy: "BUY_AND_HOLD" | "QUANTITATIVE" | "HYBRID_AI";
  asset: string;
  startDate: Date;
  endDate: Date;
  initialQuote: number;
  commissionRate: number;
  slippagePercent: number;
}

export interface BacktestMetrics {
  strategy: string;
  asset: string;
  startDate: string;
  endDate: string;
  initialQuote: number;
  finalQuote: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  totalTrades: number;
  winRate: number | null;
  avgProfit: number | null;
  avgLoss: number | null;
  commissionCost: number;
  slippageCost: number;
  aiCostUsd: number;
}

/**
 * Run buy-and-hold baseline.
 */
export async function runBuyAndHold(config: BacktestConfig): Promise<BacktestMetrics> {
  const candles = await loadCandles(config.asset, config.startDate, config.endDate);

  if (candles.length === 0) {
    return makeEmptyMetrics(config);
  }

  const firstPrice = Number(candles[0]!.close);
  const lastPrice = Number(candles[candles.length - 1]!.close);
  const quantity = config.initialQuote / firstPrice;

  const pnl = computePnl({
    side: "BUY",
    entryPrice: firstPrice,
    exitPrice: lastPrice,
    quantity,
    commissionRate: config.commissionRate,
    slippagePercent: config.slippagePercent,
  });

  const returns: number[] = [];
  let peak = config.initialQuote;
  let maxDd = 0;

  for (let i = 1; i < candles.length; i++) {
    const currentVal = Number(candles[i]!.close) * quantity;
    if (currentVal > peak) peak = currentVal;
    const dd = peak > 0 ? (peak - currentVal) / peak : 0;
    if (dd > maxDd) maxDd = dd;

    if (i > 0) {
      returns.push(Number(candles[i]!.close) / Number(candles[i - 1]!.close) - 1);
    }
  }

  const sharpe = computeSharpe(returns);
  const sortino = computeSortino(returns);

  await prisma.backtestRun.create({
    data: {
      strategy: config.strategy,
      asset: config.asset,
      startDate: config.startDate,
      endDate: config.endDate,
      initialQuote: config.initialQuote,
      finalQuote: config.initialQuote + pnl.netPnl,
      totalReturn: pnl.netReturnPercent,
      maxDrawdown: maxDd * 100,
      sharpeRatio: sharpe,
      sortinoRatio: sortino,
      totalTrades: 1,
      winRate: pnl.netPnl > 0 ? 1 : 0,
      avgProfit: pnl.netPnl > 0 ? pnl.netPnl : null,
      avgLoss: pnl.netPnl < 0 ? Math.abs(pnl.netPnl) : null,
      commissionCost: pnl.commissionCost,
      slippageCost: pnl.slippageCost,
      aiCostUsd: 0,
    },
  });

  return {
    strategy: config.strategy,
    asset: config.asset,
    startDate: config.startDate.toISOString(),
    endDate: config.endDate.toISOString(),
    initialQuote: config.initialQuote,
    finalQuote: config.initialQuote + pnl.netPnl,
    totalReturn: pnl.netReturnPercent,
    maxDrawdown: maxDd * 100,
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    totalTrades: 1,
    winRate: pnl.netPnl > 0 ? 1 : 0,
    avgProfit: pnl.netPnl > 0 ? pnl.netPnl : null,
    avgLoss: pnl.netPnl < 0 ? Math.abs(pnl.netPnl) : null,
    commissionCost: pnl.commissionCost,
    slippageCost: pnl.slippageCost,
    aiCostUsd: 0,
  };
}

/**
 * Run quantitative bot baseline (SMA crossover: SMA20 > SMA50 → BUY, SMA20 < SMA50 → SELL).
 */
export async function runQuantitativeBot(config: BacktestConfig): Promise<BacktestMetrics> {
  const candles = await loadCandles(config.asset, config.startDate, config.endDate);

  if (candles.length < 50) {
    return makeEmptyMetrics(config);
  }

  // Pre-compute SMAs using simple rolling window
  const sma20 = computeSMA(candles, 20);
  const sma50 = computeSMA(candles, 50);

  let quote = config.initialQuote;
  let quantity = 0;
  let entryPrice = 0;
  const trades: Array<{ netPnl: number }> = [];
  let totalCommission = 0;
  let totalSlippage = 0;
  let peak = config.initialQuote;
  let maxDd = 0;

  // A signal based on candle i can only be executed on candle i+1.
  for (let i = 50; i < candles.length - 1; i++) {
    const executionCandle = candles[i + 1]!;
    const price = Number(executionCandle.open);
    const sma20Val = sma20[i];
    const sma50Val = sma50[i];

    if (sma20Val == null || sma50Val == null) continue;

    const signal = sma20Val > sma50Val ? "BUY" : "SELL";

    if (signal === "BUY" && quantity === 0) {
      // Open LONG
      const slippagePrice = price * (1 + config.slippagePercent / 100);
      const commission = slippagePrice * config.initialQuote / price * config.commissionRate;
      quantity = config.initialQuote / slippagePrice;
      entryPrice = slippagePrice;
      quote -= config.initialQuote + commission;
      totalCommission += commission;
      totalSlippage += (slippagePrice - price) * quantity;
    } else if (signal === "SELL" && quantity > 0) {
      const slippagePrice = price * (1 - config.slippagePercent / 100);
      const pnl = computePnl({
        side: "BUY",
        entryPrice,
        exitPrice: slippagePrice,
        quantity,
        commissionRate: config.commissionRate,
        slippagePercent: 0,
      });
      trades.push({ netPnl: pnl.netPnl });
      const exitCommission = quantity * slippagePrice * config.commissionRate;
      quote += quantity * slippagePrice - exitCommission;
      totalCommission += exitCommission;
      totalSlippage += (price - slippagePrice) * quantity;
      quantity = 0;
    }

    // Mark-to-market for drawdown
    const currentVal = quote + quantity * price;
    if (currentVal > peak) peak = currentVal;
    const dd = peak > 0 ? (peak - currentVal) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  const finalQuote = quote + quantity * Number(candles[candles.length - 1]!.close);
  const totalReturn = config.initialQuote > 0 ? ((finalQuote - config.initialQuote) / config.initialQuote) * 100 : 0;
  const wins = trades.filter((t) => t.netPnl > 0);

  const dailyReturns = computeDailyReturns(candles.map((c) => Number(c.close)));

  await prisma.backtestRun.create({
    data: {
      strategy: config.strategy,
      asset: config.asset,
      startDate: config.startDate,
      endDate: config.endDate,
      initialQuote: config.initialQuote,
      finalQuote,
      totalReturn,
      maxDrawdown: maxDd * 100,
      sharpeRatio: computeSharpe(dailyReturns),
      sortinoRatio: computeSortino(dailyReturns),
      totalTrades: trades.length,
      winRate: trades.length > 0 ? wins.length / trades.length : null,
      avgProfit: wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : null,
      avgLoss: trades.length > wins.length ? trades.filter((t) => t.netPnl <= 0).reduce((s, t) => s + Math.abs(t.netPnl), 0) / (trades.length - wins.length) : null,
      commissionCost: totalCommission,
      slippageCost: totalSlippage,
      aiCostUsd: 0,
    },
  });

  return {
    strategy: config.strategy,
    asset: config.asset,
    startDate: config.startDate.toISOString(),
    endDate: config.endDate.toISOString(),
    initialQuote: config.initialQuote,
    finalQuote,
    totalReturn,
    maxDrawdown: maxDd * 100,
    sharpeRatio: computeSharpe(dailyReturns),
    sortinoRatio: computeSortino(dailyReturns),
    totalTrades: trades.length,
    winRate: trades.length > 0 ? wins.length / trades.length : null,
    avgProfit: wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : null,
    avgLoss: trades.length - wins.length > 0 ? trades.filter((t) => t.netPnl <= 0).reduce((s, t) => s + Math.abs(t.netPnl), 0) / (trades.length - wins.length) : null,
    commissionCost: totalCommission,
    slippageCost: totalSlippage,
    aiCostUsd: 0,
  };
}

/**
 * Replay the HYBRID_AI strategy from stored trade proposals.
 */
export async function runHybridBacktest(config: BacktestConfig): Promise<BacktestMetrics> {
  const candles = await loadCandles(config.asset, config.startDate, config.endDate);

  // Get stored proposals that resulted in APPROVED risk decisions
  const proposals = await prisma.storedTradeProposal.findMany({
    where: {
      asset: config.asset,
      status: "VALID",
      decisionGateResult: "APPROVE",
      createdAt: { gte: config.startDate, lte: config.endDate },
    },
    orderBy: { createdAt: "asc" },
  });

  if (proposals.length === 0) {
    return makeEmptyMetrics(config);
  }

  let quote = config.initialQuote;
  let quantity = 0;
  let entryPrice = 0;
  const trades: Array<{ netPnl: number }> = [];
  let totalCommission = 0;
  let totalSlippage = 0;
  let totalAiCost = 0;
  let peak = config.initialQuote;
  let maxDd = 0;

  for (const proposal of proposals) {
    const action = proposal.action;
    if (!action || (action !== "BUY" && action !== "SELL")) continue;

    // Find matching candle for the proposal timestamp
    // The first candle opening after proposal creation is the earliest
    // executable price and avoids using information from the signal candle.
    const candle = candles.find((c) => c.openTime >= proposal.createdAt);
    if (!candle) continue;

    const price = Number(candle.open);

    if (action === "BUY" && quantity === 0) {
      const riskFraction = proposal.suggestedRiskFraction ? Number(proposal.suggestedRiskFraction) : 0.02;
      const riskAmount = quote * riskFraction;
      const fallbackStop = price * 0.05;
      const positionSize = riskAmount / fallbackStop;
      const slippagePrice = price * (1 + config.slippagePercent / 100);
      const actualQty = positionSize;
      const commission = actualQty * slippagePrice * config.commissionRate;

      if (actualQty * slippagePrice + commission <= quote) {
        quantity = actualQty;
        entryPrice = slippagePrice;
        quote -= actualQty * slippagePrice + commission;
        totalCommission += commission;
        totalSlippage += (slippagePrice - price) * actualQty;
      }
    } else if (action === "SELL" && quantity > 0) {
      const slippagePrice = price * (1 - config.slippagePercent / 100);
      const pnl = computePnl({
        side: "BUY",
        entryPrice,
        exitPrice: slippagePrice,
        quantity,
        commissionRate: config.commissionRate,
        slippagePercent: 0,
      });
      trades.push({ netPnl: pnl.netPnl });
      const exitCommission = quantity * slippagePrice * config.commissionRate;
      quote += quantity * slippagePrice - exitCommission;
      totalCommission += exitCommission;
      totalSlippage += (price - slippagePrice) * quantity;
      quantity = 0;
    }

    totalAiCost += Number(proposal.estimatedCostUsd);

    // Drawdown
    const currentVal = quote + quantity * Number(candle.close);
    if (currentVal > peak) peak = currentVal;
    const dd = peak > 0 ? (peak - currentVal) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  const finalPrice = Number(candles[candles.length - 1]!.close);
  const finalQuote = quote + quantity * finalPrice;
  const totalReturn = config.initialQuote > 0 ? ((finalQuote - config.initialQuote) / config.initialQuote) * 100 : 0;
  const wins = trades.filter((t) => t.netPnl > 0);

  const dailyReturns = computeDailyReturns(candles.map((c) => Number(c.close)));

  await prisma.backtestRun.create({
    data: {
      strategy: config.strategy,
      asset: config.asset,
      startDate: config.startDate,
      endDate: config.endDate,
      initialQuote: config.initialQuote,
      finalQuote,
      totalReturn,
      maxDrawdown: maxDd * 100,
      sharpeRatio: computeSharpe(dailyReturns),
      sortinoRatio: computeSortino(dailyReturns),
      totalTrades: trades.length,
      winRate: trades.length > 0 ? wins.length / trades.length : null,
      avgProfit: wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : null,
      avgLoss: trades.length - wins.length > 0 ? trades.filter((t) => t.netPnl <= 0).reduce((s, t) => s + Math.abs(t.netPnl), 0) / (trades.length - wins.length) : null,
      commissionCost: totalCommission,
      slippageCost: totalSlippage,
      aiCostUsd: totalAiCost,
    },
  });

  return {
    strategy: config.strategy,
    asset: config.asset,
    startDate: config.startDate.toISOString(),
    endDate: config.endDate.toISOString(),
    initialQuote: config.initialQuote,
    finalQuote,
    totalReturn,
    maxDrawdown: maxDd * 100,
    sharpeRatio: computeSharpe(dailyReturns),
    sortinoRatio: computeSortino(dailyReturns),
    totalTrades: trades.length,
    winRate: trades.length > 0 ? wins.length / trades.length : null,
    avgProfit: wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : null,
    avgLoss: trades.length - wins.length > 0 ? trades.filter((t) => t.netPnl <= 0).reduce((s, t) => s + Math.abs(t.netPnl), 0) / (trades.length - wins.length) : null,
    commissionCost: totalCommission,
    slippageCost: totalSlippage,
    aiCostUsd: totalAiCost,
  };
}

// --- Helpers ---

async function loadCandles(asset: string, start: Date, end: Date): Promise<PriceCandle[]> {
  const dbAsset = await prisma.asset.findUnique({ where: { symbol: asset } });
  if (!dbAsset) return [];

  return prisma.priceCandle.findMany({
    where: {
      assetId: dbAsset.id,
      openTime: { gte: start, lte: end },
    },
    orderBy: { openTime: "asc" },
  });
}

function computeSMA(candles: PriceCandle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += Number(candles[i]!.close);
    if (i >= period) sum -= Number(candles[i - period]!.close);
    result.push(i >= period - 1 ? sum / period : null);
  }
  return result;
}

function computeSharpe(dailyReturns: number[]): number | null {
  if (dailyReturns.length < 2) return null;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  if (variance === 0) return 0;
  return mean / Math.sqrt(variance) * Math.sqrt(365);
}

function computeSortino(dailyReturns: number[]): number | null {
  if (dailyReturns.length < 2) return null;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const downside = dailyReturns.filter((r) => r < 0);
  if (downside.length === 0) return null;
  const downsideVar = downside.reduce((s, r) => s + r ** 2, 0) / downside.length;
  if (downsideVar === 0) return 0;
  return mean / Math.sqrt(downsideVar) * Math.sqrt(365);
}

function computeDailyReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(prices[i]! / prices[i - 1]! - 1);
  }
  return returns;
}

function makeEmptyMetrics(config: BacktestConfig): BacktestMetrics {
  return {
    strategy: config.strategy,
    asset: config.asset,
    startDate: config.startDate.toISOString(),
    endDate: config.endDate.toISOString(),
    initialQuote: config.initialQuote,
    finalQuote: config.initialQuote,
    totalReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: null,
    sortinoRatio: null,
    totalTrades: 0,
    winRate: null,
    avgProfit: null,
    avgLoss: null,
    commissionCost: 0,
    slippageCost: 0,
    aiCostUsd: 0,
  };
}
