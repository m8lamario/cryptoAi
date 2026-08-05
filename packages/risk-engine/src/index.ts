// Phase 2 — Risk Engine
// Deterministic risk controls: no LLM can bypass this.

export { computePositionSize } from "./position-sizer.js";
export { evaluateTradeProposal } from "./risk-manager.js";
export type { RiskManagerOptions } from "./risk-manager.js";
export { evaluateDecisionGate } from "./decision-gate.js";
export type { DecisionGateResult, DecisionGateConfig, DecisionGateReport } from "./decision-gate.js";

export {
  evaluateAutoApproval,
  DEFAULT_AUTO_APPROVAL_RULES,
} from "./auto-approval.js";
export type {
  AutoApprovalRule,
  AutoApprovalInput,
  AutoApprovalResult,
  OperatingMode,
} from "./auto-approval.js";

export {
  initOperatingMode,
  getOperatingMode,
  getAutoApprovalRules,
  setOperatingMode,
  setAutoApprovalRules,
} from "./operating-mode.js";

export {
  TradeActionSchema,
  TradeProposalStatusSchema,
  TradeProposalSchema,
  RiskDecisionStatusSchema,
  RiskDecisionSchema,
  RiskProfileSchema,
  RULE_CODES,
  TradingPlanSchema,
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
  TradingPlan,
} from "./types.js";
