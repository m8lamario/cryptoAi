export interface CostModelInput {
  notional: number;
  commissionRate: number;
  spreadPercent: number;
  slippagePercent: number;
  expectedTurnover: number;
}

export interface CostEstimate {
  spread: number;
  slippage: number;
  fees: number;
  turnover: number;
  total: number;
}

export function estimateTradingCosts(input: CostModelInput): CostEstimate {
  if (!Number.isFinite(input.notional) || input.notional < 0) {
    throw new Error("notional must be finite and non-negative");
  }
  const spread = input.notional * Math.max(0, input.spreadPercent) / 100;
  const slippage = input.notional * Math.max(0, input.slippagePercent) / 100;
  const fees = input.notional * Math.max(0, input.commissionRate);
  const turnover = input.notional * Math.max(0, input.expectedTurnover) * 0.05;
  return {
    spread,
    slippage,
    fees,
    turnover,
    total: spread + slippage + fees + turnover,
  };
}

export function netEdgePercent(
  expectedMovePercent: number,
  expectedRiskPercent: number,
  costs: CostEstimate,
  notional: number,
  riskPenalty = 0.5,
): number {
  if (!Number.isFinite(notional) || notional <= 0) return Number.NEGATIVE_INFINITY;
  return expectedMovePercent - expectedRiskPercent * riskPenalty - (costs.total / notional) * 100;
}
