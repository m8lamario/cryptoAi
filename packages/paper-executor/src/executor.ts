import { prisma } from "@cryptoai/database";
import { computePnl } from "@cryptoai/quantitative";
import { randomUUID } from "node:crypto";

/**
 * Phase 7 — Paper Trading Executor.
 *
 * Executes simulated orders against virtual balance.
 * All calculations are deterministic. No real money involved.
 */

export interface PaperExecutorConfig {
  /** Initial quote currency balance (USDT) */
  initialBalance: number;
  /** Commission rate (e.g. 0.001 for 0.1%) */
  commissionRate: number;
  /** Slippage percentage (e.g. 0.05 for 0.05%) */
  slippagePercent: number;
  /** Minimum position size in asset units */
  minPositionSize: number;
}

export interface ExecutionResult {
  orderId: string;
  status: "FILLED" | "REJECTED";
  quantity: number;
  price: number;
  commission: number;
  reason?: string;
}

/**
 * Initialize paper balance if none exists.
 */
export async function initPaperBalance(initialBalance: number): Promise<void> {
  const existing = await prisma.paperBalance.findFirst();
  if (!existing) {
    await prisma.paperBalance.create({
      data: {
        quote: initialBalance,
        peakValue: initialBalance,
        dailyPnl: 0,
      },
    });
  }
}

/**
 * Get current paper portfolio state.
 */
export async function getPaperPortfolio(): Promise<{
  balance: number;
  peakValue: number;
  dailyPnl: number;
  positions: Array<{
    asset: string;
    side: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    stopLoss: number | null;
  }>;
  totalExposure: number;
  totalValue: number;
}> {
  const balance = await prisma.paperBalance.findFirst();
  const positions = await prisma.paperPosition.findMany({ where: { status: "OPEN" } });

  const quote = Number(balance?.quote ?? 0);
  let totalExposure = 0;

  const posList = positions.map((p) => {
    const exposure = Number(p.quantity) * Number(p.currentPrice);
    totalExposure += exposure;
    return {
      asset: p.asset,
      side: p.side,
      quantity: Number(p.quantity),
      entryPrice: Number(p.entryPrice),
      currentPrice: Number(p.currentPrice),
      unrealizedPnl: Number(p.unrealizedPnl),
      stopLoss: p.stopLoss ? Number(p.stopLoss) : null,
    };
  });

  // Exposure is already marked to the current market value. Adding
  // unrealized P&L here would count the position value twice.
  const portfolioValue = quote + totalExposure;

  return {
    balance: quote,
    peakValue: Number(balance?.peakValue ?? initialBalance),
    dailyPnl: Number(balance?.dailyPnl ?? 0),
    positions: posList,
    totalExposure,
    totalValue: Number((portfolioValue).toFixed(2)),
  };
}

const initialBalance = 10000;

/**
 * Execute a paper buy order.
 */
export async function executePaperBuy(
  asset: string,
  quantity: number,
  price: number,
  config: PaperExecutorConfig,
  proposalRunId?: string,
  riskDecisionId?: string,
): Promise<ExecutionResult> {
  const existingOrder = riskDecisionId
    ? await prisma.paperOrder.findFirst({ where: { riskDecisionId, status: "FILLED" } })
    : proposalRunId
      ? await prisma.paperOrder.findFirst({ where: { proposalRunId, status: "FILLED" } })
      : null;
  if (existingOrder) {
    return {
      orderId: existingOrder.orderId,
      status: "FILLED",
      quantity: Number(existingOrder.quantity),
      price: Number(existingOrder.price),
      commission: Number(existingOrder.commission),
    };
  }

  const balance = await prisma.paperBalance.findFirst();
  const quote = Number(balance?.quote ?? 0);

  if (!balance || !Number.isFinite(quantity) || quantity < config.minPositionSize || !Number.isFinite(price) || price <= 0) {
    return {
      orderId: randomUUID(),
      status: "REJECTED",
      quantity: 0,
      price,
      commission: 0,
      reason: !balance ? "Paper balance is not initialized" : "Invalid or below-minimum order parameters",
    };
  }

  const slippage = price * (1 + config.slippagePercent / 100);
  const commission = quantity * slippage * config.commissionRate;
  const totalCost = quantity * slippage + commission;

  if (totalCost > quote) {
    return {
      orderId: randomUUID(),
      status: "REJECTED",
      quantity: 0,
      price,
      commission: 0,
      reason: `Insufficient balance: need ${totalCost.toFixed(2)}, have ${quote.toFixed(2)}`,
    };
  }

  const orderId = randomUUID();
  await prisma.paperOrder.create({
    data: {
      orderId,
      asset,
      side: "BUY",
      type: "MARKET",
      quantity,
      price: slippage,
      commission,
      slippagePercent: config.slippagePercent,
      status: "FILLED",
      proposalRunId: proposalRunId ?? null,
      riskDecisionId: riskDecisionId ?? null,
      executedAt: new Date(),
    },
  });

  // Open or add to position
  const existing = await prisma.paperPosition.findFirst({
    where: { asset, side: "LONG", status: "OPEN" },
  });

  if (existing) {
    const newQty = Number(existing.quantity) + quantity;
    const newEntry = (Number(existing.entryPrice) * Number(existing.quantity) + slippage * quantity) / newQty;
    await prisma.paperPosition.update({
      where: { id: existing.id },
      data: {
        quantity: newQty,
        entryPrice: newEntry,
        currentPrice: price,
        unrealizedPnl: (price - newEntry) * newQty,
      },
    });
  } else {
    await prisma.paperPosition.create({
      data: {
        asset,
        side: "LONG",
        quantity,
        entryPrice: slippage,
        currentPrice: price,
        unrealizedPnl: (price - slippage) * quantity,
        status: "OPEN",
      },
    });
  }

  // Update balance
  await prisma.paperBalance.update({
    where: { id: balance.id },
    data: { quote: quote - totalCost },
  });

  return { orderId, status: "FILLED", quantity, price: slippage, commission };
}

/**
 * Execute a paper sell order (close/partial).
 */
export async function executePaperSell(
  asset: string,
  quantity: number,
  price: number,
  config: PaperExecutorConfig,
  proposalRunId?: string,
  riskDecisionId?: string,
): Promise<ExecutionResult> {
  const existingOrder = riskDecisionId
    ? await prisma.paperOrder.findFirst({ where: { riskDecisionId, status: "FILLED" } })
    : proposalRunId
      ? await prisma.paperOrder.findFirst({ where: { proposalRunId, status: "FILLED" } })
      : null;
  if (existingOrder) {
    return {
      orderId: existingOrder.orderId,
      status: "FILLED",
      quantity: Number(existingOrder.quantity),
      price: Number(existingOrder.price),
      commission: Number(existingOrder.commission),
    };
  }

  const position = await prisma.paperPosition.findFirst({
    where: { asset, side: "LONG", status: "OPEN" },
  });

  if (!position || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
    return {
      orderId: randomUUID(),
      status: "REJECTED",
      quantity: 0,
      price,
      commission: 0,
      reason: "No open LONG position for this asset",
    };
  }

  const balance = await prisma.paperBalance.findFirst();
  if (!balance) {
    return {
      orderId: randomUUID(),
      status: "REJECTED",
      quantity: 0,
      price,
      commission: 0,
      reason: "Paper balance is not initialized",
    };
  }

  const posQty = Number(position.quantity);
  const closeQty = Math.min(quantity, posQty);
  const slippage = price * (1 - config.slippagePercent / 100);
  const commission = closeQty * slippage * config.commissionRate;

  const pnl = computePnl({
    side: "BUY",
    entryPrice: Number(position.entryPrice),
    exitPrice: slippage,
    quantity: closeQty,
    commissionRate: config.commissionRate,
    // Entry and exit fills already include the configured slippage.
    slippagePercent: 0,
  });

  const orderId = randomUUID();
  await prisma.paperOrder.create({
    data: {
      orderId,
      asset,
      side: "SELL",
      type: "MARKET",
      quantity: closeQty,
      price: slippage,
      commission,
      slippagePercent: config.slippagePercent,
      status: "FILLED",
      proposalRunId: proposalRunId ?? null,
      riskDecisionId: riskDecisionId ?? null,
      executedAt: new Date(),
    },
  });

  const remaining = posQty - closeQty;
  if (remaining <= 0.00001) {
    await prisma.paperPosition.update({
      where: { id: position.id },
      data: {
        quantity: 0,
        currentPrice: price,
        unrealizedPnl: 0,
        status: "CLOSED",
        closedAt: new Date(),
      },
    });
  } else {
    await prisma.paperPosition.update({
      where: { id: position.id },
      data: {
        quantity: remaining,
        currentPrice: price,
        unrealizedPnl: (price - Number(position.entryPrice)) * remaining,
      },
    });
  }

  // Update balance
  const quote = Number(balance.quote);
  const proceeds = closeQty * slippage - commission;
  const newQuote = quote + proceeds;
  const newPeak = Number(balance?.peakValue ?? initialBalance);

  // Update daily PnL
  const dailyPnl = (await prisma.paperBalance.findFirst())?.dailyPnl ?? 0;

  await prisma.paperBalance.update({
    where: { id: balance.id },
    data: {
      quote: newQuote,
      peakValue: newQuote > newPeak ? newQuote : newPeak,
      dailyPnl: Number(dailyPnl) + pnl.netPnl,
    },
  });

  return { orderId, status: "FILLED", quantity: closeQty, price: slippage, commission };
}

/**
 * Update position mark prices (called periodically).
 * Also updates PaperBalance totalValue, dailyPnl, and peakValue.
 */
export async function markToMarket(prices: Array<{ asset: string; price: number }>): Promise<void> {
  const balance = await prisma.paperBalance.findFirst();
  if (!balance) return;

  const positions = await prisma.paperPosition.findMany({ where: { status: "OPEN" } });
  let totalExposure = 0;
  let totalUnrealizedPnl = 0;

  for (const pos of positions) {
    const p = prices.find((px) => px.asset === pos.asset);
    if (!p) {
      totalExposure += Number(pos.quantity) * Number(pos.currentPrice);
      totalUnrealizedPnl += Number(pos.unrealizedPnl);
      continue;
    }

    const entry = Number(pos.entryPrice);
    const qty = Number(pos.quantity);
    const unrealized = pos.side === "LONG"
      ? (p.price - entry) * qty
      : (entry - p.price) * qty;

    totalExposure += qty * p.price;
    totalUnrealizedPnl += unrealized;

    await prisma.paperPosition.update({
      where: { id: pos.id },
      data: { currentPrice: p.price, unrealizedPnl: unrealized },
    });
  }

  const totalValue = Number(balance.quote) + totalExposure;
  const currentPeak = Number(balance.peakValue);

  await prisma.paperBalance.update({
    where: { id: balance.id },
    data: {
      peakValue: totalValue > currentPeak ? totalValue : currentPeak,
    },
  });
}
