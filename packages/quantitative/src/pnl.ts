/**
 * Profit & Loss calculator for paper and real trading.
 * All calculations are deterministic.
 */

export interface PnLInput {
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  commissionRate: number; // e.g., 0.001 for 0.1%
  slippagePercent: number; // e.g., 0.05 for 0.05%
}

export interface PnLResult {
  grossPnl: number;
  commissionCost: number;
  slippageCost: number;
  netPnl: number;
  grossReturnPercent: number;
  netReturnPercent: number;
}

/**
 * Computes P&L from a completed trade.
 * BUY: profit when exitPrice > entryPrice
 * SELL: profit when exitPrice < entryPrice
 */
export function computePnl(input: PnLInput): PnLResult {
  const entryNotional = input.entryPrice * input.quantity;

  let grossPnl: number;
  if (input.side === "BUY") {
    grossPnl = (input.exitPrice - input.entryPrice) * input.quantity;
  } else {
    grossPnl = (input.entryPrice - input.exitPrice) * input.quantity;
  }

  // Commission paid on both entry and exit
  const exitNotional = input.exitPrice * input.quantity;
  const commissionCost = (entryNotional + exitNotional) * input.commissionRate;

  // Slippage applied to entry price (worse fill)
  const slippageCost = entryNotional * (input.slippagePercent / 100);

  const netPnl = grossPnl - commissionCost - slippageCost;
  const grossReturnPercent = entryNotional > 0 ? (grossPnl / entryNotional) * 100 : 0;
  const netReturnPercent = entryNotional > 0 ? (netPnl / entryNotional) * 100 : 0;

  return {
    grossPnl,
    commissionCost,
    slippageCost,
    netPnl,
    grossReturnPercent,
    netReturnPercent,
  };
}

/**
 * Computes unrealized P&L for an open position.
 */
export function computeUnrealizedPnl(
  side: "BUY" | "SELL",
  entryPrice: number,
  currentPrice: number,
  quantity: number,
): number {
  if (side === "BUY") {
    return (currentPrice - entryPrice) * quantity;
  }
  return (entryPrice - currentPrice) * quantity;
}

