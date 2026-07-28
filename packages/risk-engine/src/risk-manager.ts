import { createHash } from "node:crypto";
import type {
  TradeProposal,
  RiskDecision,
  RiskProfileConfig,
  PortfolioSnapshot,
  AssetPrice,
  RuleCode,
} from "./types.js";
import { computePositionSize } from "./position-sizer.js";

export interface RiskManagerOptions {
  /** Risk profile parameters */
  riskProfile: RiskProfileConfig;
  /** Current portfolio state */
  portfolio: PortfolioSnapshot;
  /** Current asset prices */
  prices: AssetPrice[];
  /** Is the kill switch active? */
  killSwitchActive: boolean;
  /** Minimum confidence threshold for proposals */
  minConfidence: number;
  /** Minimum position size in asset units */
  minPositionSize: number;
  /** Max staleness for market data (milliseconds) */
  maxDataAgeMs: number;
  /** Current time (injectable for testing) */
  now?: Date;
  /** Optional ATR value for stop-loss calculation */
  atrValue?: number | null;
}

function generateIdempotencyKey(tradeProposal: TradeProposal, now: Date): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(tradeProposal));
  hash.update(now.toISOString());
  return hash.digest("hex").substring(0, 16);
}

function makeDecision(
  status: "APPROVE" | "BLOCK",
  ruleCode: RuleCode,
  reason: string,
  options: {
    observedValue?: number | null;
    configuredLimit?: number | null;
    positionSize?: number | null;
    stopLoss?: number | null;
    idempotencyKey: string;
    now: Date;
  },
): RiskDecision {
  return {
    status: status === "APPROVE" ? "APPROVE" : "BLOCK",
    ruleCode,
    reason,
    observedValue: options.observedValue ?? null,
    configuredLimit: options.configuredLimit ?? null,
    positionSize: options.positionSize ?? null,
    stopLoss: options.stopLoss ?? null,
    idempotencyKey: options.idempotencyKey,
    decidedAt: options.now.toISOString(),
  };
}

/**
 * Deterministic Risk Manager.
 *
 * Evaluates a TradeProposal against all risk limits and returns an APPROVE or BLOCK decision.
 * The Risk Manager has absolute veto power — no LLM can bypass it.
 */
export function evaluateTradeProposal(
  proposal: TradeProposal,
  options: RiskManagerOptions,
): RiskDecision {
  const now = options.now ?? new Date();
  const idempotencyKey = generateIdempotencyKey(proposal, now);

  // 1. Kill switch check
  if (options.killSwitchActive) {
    return makeDecision("BLOCK", "KILL_SWITCH_ACTIVE", "Kill switch is active", {
      idempotencyKey,
      now,
    });
  }

  // 2. Data staleness check
  const oldestPrice = options.prices.reduce(
    (oldest, p) => (p.collectedAt < oldest ? p.collectedAt : oldest),
    options.prices[0]?.collectedAt ?? now,
  );

  if (options.prices.length === 0) {
    return makeDecision("BLOCK", "DATA_TOO_STALE", "No price data available", {
      observedValue: 0,
      configuredLimit: 1,
      idempotencyKey,
      now,
    });
  }

  const dataAgeMs = now.getTime() - oldestPrice.getTime();
  if (dataAgeMs > options.maxDataAgeMs) {
    return makeDecision("BLOCK", "DATA_TOO_STALE", `Market data is too stale (${Math.round(dataAgeMs / 1000)}s old)`, {
      observedValue: dataAgeMs,
      configuredLimit: options.maxDataAgeMs,
      idempotencyKey,
      now,
    });
  }

  // 3. Proposal status checks
  if (proposal.status === "NO_ACTION" || proposal.action === "HOLD" || proposal.action === "WAIT") {
    return makeDecision("BLOCK", "NO_ACTION_PROPOSAL", `No action required (${proposal.status})`, {
      idempotencyKey,
      now,
    });
  }

  if (proposal.status === "UNAVAILABLE") {
    return makeDecision("BLOCK", "UNAVAILABLE_PROPOSAL", "AI proposal is unavailable", {
      idempotencyKey,
      now,
    });
  }

  if (proposal.status === "INVALID") {
    return makeDecision("BLOCK", "INVALID_PROPOSAL", "AI proposal is invalid", {
      idempotencyKey,
      now,
    });
  }

  if (proposal.status === "AMBIGUOUS") {
    return makeDecision(
      "BLOCK",
      "AMBIGUOUS_PROPOSAL",
      "AI proposal is ambiguous — manual review required",
      { idempotencyKey, now },
    );
  }

  // 4. Null action check
  if (proposal.action === null) {
    return makeDecision("BLOCK", "NULL_ACTION", "Proposal has no action specified", {
      idempotencyKey,
      now,
    });
  }

  // 5. Confidence check
  if (proposal.confidence < options.minConfidence) {
    return makeDecision("BLOCK", "CONFIDENCE_TOO_LOW", `Confidence ${proposal.confidence} below minimum ${options.minConfidence}`, {
      observedValue: proposal.confidence,
      configuredLimit: options.minConfidence,
      idempotencyKey,
      now,
    });
  }

  // 6. Get asset price
  const assetPrice = options.prices.find((p) => p.symbol === proposal.asset);
  if (!assetPrice) {
    return makeDecision("BLOCK", "DATA_TOO_STALE", `No price data for ${proposal.asset}`, {
      idempotencyKey,
      now,
    });
  }

  const entryPrice = assetPrice.price;

  // 7. Daily loss check
  const dailyLossPercent =
    options.portfolio.totalValue > 0
      ? Math.abs(Math.min(0, options.portfolio.dailyPnl) / options.portfolio.totalValue) * 100
      : 0;

  if (dailyLossPercent >= options.riskProfile.maxDailyLossPercent) {
    return makeDecision("BLOCK", "MAX_DAILY_LOSS", `Daily loss ${dailyLossPercent.toFixed(2)}% exceeds limit ${options.riskProfile.maxDailyLossPercent}%`, {
      observedValue: dailyLossPercent,
      configuredLimit: options.riskProfile.maxDailyLossPercent,
      idempotencyKey,
      now,
    });
  }

  // 8. Drawdown check
  const drawdownPercent =
    options.portfolio.peakValue > 0
      ? ((options.portfolio.peakValue - options.portfolio.totalValue) / options.portfolio.peakValue) * 100
      : 0;

  if (drawdownPercent >= options.riskProfile.maxDrawdownPercent) {
    return makeDecision("BLOCK", "MAX_DRAWDOWN", `Drawdown ${drawdownPercent.toFixed(2)}% exceeds limit ${options.riskProfile.maxDrawdownPercent}%`, {
      observedValue: drawdownPercent,
      configuredLimit: options.riskProfile.maxDrawdownPercent,
      idempotencyKey,
      now,
    });
  }

  // 9. Position sizing
  const riskFraction = proposal.suggestedRiskFraction ?? 0.01;
  const sizing = computePositionSize({
    portfolioValue: options.portfolio.totalValue,
    entryPrice,
    atrValue: options.atrValue ?? null,
    riskFraction,
    maxAssetExposurePercent: options.riskProfile.maxAssetExposurePercent,
    minPositionSize: options.minPositionSize,
  });

  if (sizing.positionSize <= 0) {
    return makeDecision("BLOCK", "POSITION_SIZE_BELOW_MINIMUM", `Position size ${sizing.positionSize} below minimum ${options.minPositionSize}`, {
      observedValue: sizing.positionSize,
      configuredLimit: options.minPositionSize,
      idempotencyKey,
      now,
    });
  }

  // 10. Check total portfolio exposure after this trade
  const newExposureNotional = sizing.positionSize * entryPrice;
  const newAssetExposure = options.portfolio.assetExposure + newExposureNotional;
  const newAssetExposurePercent =
    options.portfolio.totalValue > 0
      ? (newAssetExposure / options.portfolio.totalValue) * 100
      : 0;

  if (newAssetExposurePercent > options.riskProfile.maxAssetExposurePercent + 1e-6) {
    return makeDecision("BLOCK", "MAX_ASSET_EXPOSURE", `Asset exposure ${newAssetExposurePercent.toFixed(2)}% would exceed limit ${options.riskProfile.maxAssetExposurePercent}%`, {
      observedValue: newAssetExposurePercent,
      configuredLimit: options.riskProfile.maxAssetExposurePercent,
      positionSize: sizing.positionSize,
      stopLoss: sizing.stopLoss,
      idempotencyKey,
      now,
    });
  }

  const newTotalExposure = options.portfolio.currentExposure + newExposureNotional;
  const newExposurePercent =
    options.portfolio.totalValue > 0
      ? (newTotalExposure / options.portfolio.totalValue) * 100
      : 0;

  if (newExposurePercent > options.riskProfile.maxPortfolioExposurePercent + 1e-6) {
    return makeDecision("BLOCK", "MAX_PORTFOLIO_EXPOSURE", `Portfolio exposure ${newExposurePercent.toFixed(2)}% would exceed limit ${options.riskProfile.maxPortfolioExposurePercent}%`, {
      observedValue: newExposurePercent,
      configuredLimit: options.riskProfile.maxPortfolioExposurePercent,
      idempotencyKey,
      now,
    });
  }

  // 11. Missing stop loss check
  if (sizing.stopLoss === null) {
    return makeDecision("BLOCK", "MISSING_STOP_LOSS", "Cannot compute stop loss without ATR data", {
      idempotencyKey,
      now,
    });
  }

  // 12. All checks passed
  return makeDecision("APPROVE", "APPROVED", "All risk checks passed", {
    positionSize: sizing.positionSize,
    stopLoss: sizing.stopLoss,
    idempotencyKey,
    now,
  });
}

