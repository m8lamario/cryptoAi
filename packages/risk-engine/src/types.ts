import { z } from "zod";

// --- Trade Proposal (Phase 2 simplified input) ---

export const TradeActionSchema = z.enum(["BUY", "SELL", "HOLD", "WAIT"]);
export type TradeAction = z.infer<typeof TradeActionSchema>;

export const TradeProposalStatusSchema = z.enum([
  "VALID",
  "NO_ACTION",
  "UNAVAILABLE",
  "INVALID",
  "AMBIGUOUS",
]);

export const TradingPlanSchema = z.object({
  strategy: z.enum(["SCALPING", "INTRADAY", "SWING", "POSITION"]),
  expectedDuration: z.string().min(1),
  expectedProfitPercent: z.number(),
  expectedRiskPercent: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  suggestedEntry: z.number().positive(),
  suggestedTakeProfit: z.number().positive(),
  suggestedStopLoss: z.number().positive(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]),
  reasons: z.array(z.string()).min(1),
});

export type TradingPlan = z.infer<typeof TradingPlanSchema>;

export const TradeProposalSchema = z.object({
  status: TradeProposalStatusSchema,
  asset: z.string(),
  action: TradeActionSchema.nullable(),
  confidence: z.number().min(0).max(1),
  rationale: z.array(z.string()),
  reportIds: z.array(z.string()),
  /** Deprecated compatibility field; deterministic risk sizing must not trust it. */
  suggestedRiskFraction: z.number().min(0).max(1).nullable(),
  invalidationConditions: z.array(z.string()),
  expiresAt: z.string().datetime().nullable(),
  tradingPlan: TradingPlanSchema.nullable().default(null),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
});

export type TradeProposal = z.infer<typeof TradeProposalSchema>;

// --- Risk Decision ---

export const RiskDecisionStatusSchema = z.enum(["APPROVE", "BLOCK"]);
export type RiskDecisionStatus = z.infer<typeof RiskDecisionStatusSchema>;

/** Rule codes for audit traceability */
export const RULE_CODES = [
  "KILL_SWITCH_ACTIVE",
  "DATA_TOO_STALE",
  "NO_ACTION_PROPOSAL",
  "UNAVAILABLE_PROPOSAL",
  "INVALID_PROPOSAL",
  "AMBIGUOUS_PROPOSAL",
  "CONFIDENCE_TOO_LOW",
  "NULL_ACTION",
  "MAX_PORTFOLIO_EXPOSURE",
  "MAX_ASSET_EXPOSURE",
  "MAX_DAILY_LOSS",
  "MAX_DRAWDOWN",
  "POSITION_SIZE_BELOW_MINIMUM",
  "MISSING_STOP_LOSS",
  "APPROVED",
] as const;

export type RuleCode = (typeof RULE_CODES)[number];

export const RiskDecisionSchema = z.object({
  status: RiskDecisionStatusSchema,
  ruleCode: z.enum(RULE_CODES),
  reason: z.string(),
  observedValue: z.number().nullable(),
  configuredLimit: z.number().nullable(),
  positionSize: z.number().nullable(),
  stopLoss: z.number().nullable(),
  idempotencyKey: z.string(),
  decidedAt: z.string().datetime(),
});

export type RiskDecision = z.infer<typeof RiskDecisionSchema>;

// --- Risk Profile (mirrors DB model) ---

export const RiskProfileSchema = z.object({
  maxPortfolioExposurePercent: z.number().min(0).max(100),
  maxAssetExposurePercent: z.number().min(0).max(100),
  maxDailyLossPercent: z.number().min(0).max(100),
  maxDrawdownPercent: z.number().min(0).max(100),
});

export type RiskProfileConfig = z.infer<typeof RiskProfileSchema>;

// --- Risk Manager Context ---

export interface PortfolioSnapshot {
  /** Total portfolio value in quote currency */
  totalValue: number;
  /** Current total exposure across all open positions */
  currentExposure: number;
  /** Current exposure for the specific asset */
  assetExposure: number;
  /** Peak portfolio value (for drawdown calculation) */
  peakValue: number;
  /** Cumulative P&L for today */
  dailyPnl: number;
}

export interface AssetPrice {
  symbol: string;
  price: number;
  collectedAt: Date;
}

// --- Position Sizer ---

export interface PositionSizingInput {
  portfolioValue: number;
  entryPrice: number;
  atrValue: number | null;
  riskFraction: number; // e.g., 0.02 for 2% risk per trade
  maxAssetExposurePercent: number;
  minPositionSize: number;
}

export interface PositionSizingResult {
  positionSize: number;
  stopLoss: number | null;
  riskAmount: number;
}
