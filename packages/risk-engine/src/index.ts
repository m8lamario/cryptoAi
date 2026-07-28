// Phase 2 — Risk Engine
// Deterministic risk controls: no LLM can bypass this.

export { computePositionSize } from "./position-sizer.js";
export { evaluateTradeProposal } from "./risk-manager.js";
export type { RiskManagerOptions } from "./risk-manager.js";
export { evaluateDecisionGate } from "./decision-gate.js";
export type { DecisionGateResult, DecisionGateConfig } from "./decision-gate.js";

export {
  TradeActionSchema,
  TradeProposalStatusSchema,
  TradeProposalSchema,
  RiskDecisionStatusSchema,
  RiskDecisionSchema,
  RiskProfileSchema,
  RULE_CODES,
} from "./types.js";

export type {
  TradeAction,
  TradeProposal,
  RiskDecisionStatus,
  RuleCode,
  RiskDecision,
  RiskProfileConfig,
  PortfolioSnapshot,
  AssetPrice,
  PositionSizingInput,
  PositionSizingResult,
} from "./types.js";
