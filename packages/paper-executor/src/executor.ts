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

export interface PositionProtection {
  stopLoss?: number | null;
  takeProfit?: number | null;
}

export interface ExecutionResult {
  orderId: string;
  executionKey?: string;
  status: "FILLED" | "REJECTED";
  quantity: number;
  price: number;
  commission: number;
  reason?: string;
}

function executionKeyFor(proposalRunId?: string, riskDecisionId?: string): string | undefined {
  const key = riskDecisionId ?? proposalRunId;
  return key && key.trim() !== "" ? key : undefined;
}

function rejected(price: number, reason: string): ExecutionResult {
  return { orderId: randomUUID(), status: "REJECTED", quantity: 0, price, commission: 0, reason };
}

async function findExistingExecution(executionKey: string | undefined) {
  return executionKey
    ? prisma.paperOrder.findUnique({ where: { executionKey } })
    : null;
}

async function getOrCreateBalance(initial: number, tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  return tx.paperBalance.upsert({
    where: { singletonKey: "PAPER" },
    update: {},
    create: { singletonKey: "PAPER", quote: initial, peakValue: initial, dailyPnl: 0 },
  });
}

async function createRejectedExecution(price: number, reason: string): Promise<ExecutionResult> {
  return rejected(price, reason);
}

/**
 * Initialize paper balance if none exists.
 */
export async function initPaperBalance(initialBalance: number): Promise<void> {
  await prisma.paperBalance.upsert({
    where: { singletonKey: "PAPER" },
    update: {},
    create: { singletonKey: "PAPER", quote: initialBalance, peakValue: initialBalance, dailyPnl: 0 },
  });
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
  protection: PositionProtection = {},
): Promise<ExecutionResult> {
  const executionKey = executionKeyFor(proposalRunId, riskDecisionId);
  const existingOrder = await findExistingExecution(executionKey);
  if (existingOrder?.status === "FILLED") {
    return {
      orderId: existingOrder.orderId,
      executionKey: existingOrder.executionKey ?? undefined,
      status: "FILLED",
      quantity: Number(existingOrder.quantity),
      price: Number(existingOrder.price),
      commission: Number(existingOrder.commission),
    };
  }

  if (!Number.isFinite(quantity) || quantity < config.minPositionSize || !Number.isFinite(price) || price <= 0) {
    return createRejectedExecution(price, "Invalid or below-minimum order parameters");
  }

  const slippage = price * (1 + config.slippagePercent / 100);
  const commission = quantity * slippage * config.commissionRate;
  const totalCost = quantity * slippage + commission;
  const orderId = randomUUID();

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = executionKey
        ? await tx.paperOrder.findUnique({ where: { executionKey } })
        : null;
      if (existing?.status === "FILLED") {
        return {
          orderId: existing.orderId,
          executionKey: existing.executionKey ?? undefined,
          status: "FILLED" as const,
          quantity: Number(existing.quantity),
          price: Number(existing.price),
          commission: Number(existing.commission),
        };
      }

      const balance = await getOrCreateBalance(config.initialBalance, tx);
      const quote = Number(balance.quote);
      if (totalCost > quote) {
        return rejected(price, `Insufficient balance: need ${totalCost.toFixed(2)}, have ${quote.toFixed(2)}`);
      }

      const position = await tx.paperPosition.findFirst({
        where: { asset, side: "LONG", status: "OPEN" },
      });
      if (position) {
        const newQty = Number(position.quantity) + quantity;
        const newEntry = (Number(position.entryPrice) * Number(position.quantity) + slippage * quantity) / newQty;
        await tx.paperPosition.update({
          where: { id: position.id },
          data: { quantity: newQty, entryPrice: newEntry, currentPrice: price, unrealizedPnl: (price - newEntry) * newQty, stopLoss: protection.stopLoss ?? position.stopLoss, takeProfit: protection.takeProfit ?? position.takeProfit },
        });
      } else {
        await tx.paperPosition.create({
          data: { asset, side: "LONG", quantity, entryPrice: slippage, currentPrice: price, unrealizedPnl: (price - slippage) * quantity, stopLoss: protection.stopLoss ?? null, takeProfit: protection.takeProfit ?? null, status: "OPEN" },
        });
      }

      await tx.paperBalance.update({ where: { id: balance.id }, data: { quote: quote - totalCost } });
      await tx.paperOrder.create({
        data: { orderId, executionKey: executionKey ?? null, asset, side: "BUY", type: "MARKET", quantity, price: slippage, commission, slippagePercent: config.slippagePercent, status: "FILLED", proposalRunId: proposalRunId ?? null, riskDecisionId: riskDecisionId ?? null, executedAt: new Date() },
      });
      return { orderId, executionKey, status: "FILLED" as const, quantity, price: slippage, commission };
    });
  } catch (error) {
    if (executionKey) {
      const existing = await findExistingExecution(executionKey);
      if (existing?.status === "FILLED") {
        return { orderId: existing.orderId, executionKey, status: "FILLED", quantity: Number(existing.quantity), price: Number(existing.price), commission: Number(existing.commission) };
      }
    }
    throw error;
  }
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
  const executionKey = executionKeyFor(proposalRunId, riskDecisionId);
  const existingOrder = await findExistingExecution(executionKey);
  if (existingOrder?.status === "FILLED") {
    return {
      orderId: existingOrder.orderId,
      executionKey: existingOrder.executionKey ?? undefined,
      status: "FILLED",
      quantity: Number(existingOrder.quantity),
      price: Number(existingOrder.price),
      commission: Number(existingOrder.commission),
    };
  }

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
    return rejected(price, "Invalid sell parameters");
  }

  const orderId = randomUUID();
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = executionKey
        ? await tx.paperOrder.findUnique({ where: { executionKey } })
        : null;
      if (existing?.status === "FILLED") {
        return { orderId: existing.orderId, executionKey: existing.executionKey ?? undefined, status: "FILLED" as const, quantity: Number(existing.quantity), price: Number(existing.price), commission: Number(existing.commission) };
      }

      const position = await tx.paperPosition.findFirst({ where: { asset, side: "LONG", status: "OPEN" } });
      const balance = await tx.paperBalance.findUnique({ where: { singletonKey: "PAPER" } });
      if (!position) return rejected(price, "No open LONG position for this asset");
      if (!balance) return rejected(price, "Paper balance is not initialized");

      const posQty = Number(position.quantity);
      if (quantity > posQty + 1e-8) return rejected(price, "Sell quantity exceeds open position");
      const closeQty = quantity;
      const slippage = price * (1 - config.slippagePercent / 100);
      const commission = closeQty * slippage * config.commissionRate;
      const pnl = computePnl({ side: "BUY", entryPrice: Number(position.entryPrice), exitPrice: slippage, quantity: closeQty, commissionRate: config.commissionRate, slippagePercent: 0 });

      await tx.paperOrder.create({
        data: { orderId, executionKey: executionKey ?? null, asset, side: "SELL", type: "MARKET", quantity: closeQty, price: slippage, commission, slippagePercent: config.slippagePercent, status: "FILLED", proposalRunId: proposalRunId ?? null, riskDecisionId: riskDecisionId ?? null, executedAt: new Date() },
      });

      const remaining = posQty - closeQty;
      if (remaining <= 1e-8) {
        await tx.paperPosition.update({ where: { id: position.id }, data: { quantity: 0, currentPrice: price, unrealizedPnl: 0, status: "CLOSED", closedAt: new Date() } });
      } else {
        await tx.paperPosition.update({ where: { id: position.id }, data: { quantity: remaining, currentPrice: price, unrealizedPnl: (price - Number(position.entryPrice)) * remaining } });
      }

      const quote = Number(balance.quote);
      const proceeds = closeQty * slippage - commission;
      await tx.paperBalance.update({ where: { id: balance.id }, data: { quote: quote + proceeds, peakValue: Math.max(Number(balance.peakValue), quote + proceeds), dailyPnl: Number(balance.dailyPnl) + pnl.netPnl } });
      return { orderId, executionKey, status: "FILLED" as const, quantity: closeQty, price: slippage, commission };
    });
  } catch (error) {
    if (executionKey) {
      const existing = await findExistingExecution(executionKey);
      if (existing?.status === "FILLED") return { orderId: existing.orderId, executionKey, status: "FILLED", quantity: Number(existing.quantity), price: Number(existing.price), commission: Number(existing.commission) };
    }
    throw error;
  }
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
      dailyPnl: totalUnrealizedPnl,
    },
  });
}
