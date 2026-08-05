// Technical shared contracts – Fase 0 + Fase 1 + v1.4 updates
// No AI agents, no trade proposals, no exchange contracts.

export type SystemEventLevel = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export interface HealthStatus {
  status: "ok";
  uptime: number;
  timestamp: string;
}

export interface ReadinessStatus {
  ready: boolean;
  timestamp: string;
  checks: {
    postgres: "ok" | "unavailable";
    redis: "ok" | "unavailable";
  };
}

// --- Phase 1: Market Data ---

export interface MarketSnapshotResponse {
  symbol: string;
  price: number;
  change24h: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  collectedAt: string;
}

export interface CandleResponse {
  symbol: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  interval: string;
}

export interface LatestResponse {
  snapshots: MarketSnapshotResponse[];
  collectedAt: string;
}

export interface HistoryResponse {
  symbol: string;
  interval: string;
  candles: CandleResponse[];
  count: number;
}

export interface CollectionStatusResponse {
  lastRun: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    status: string;
    provider: string;
    error: string | null;
  } | null;
  assetCount: number;
}

// --- Phase 2: Quantitative & Risk Engine ---

export interface KillSwitchResponse {
  active: boolean;
  reason: string | null;
  updatedAt: string;
}

export interface RiskDecisionResponse {
  id: string;
  status: "APPROVE" | "BLOCK";
  ruleCode: string;
  reason: string;
  asset: string;
  observedValue: number | null;
  configuredLimit: number | null;
  positionSize: number | null;
  stopLoss: number | null;
  idempotencyKey: string;
  decidedAt: string;
}

export interface RiskDecisionsResponse {
  decisions: RiskDecisionResponse[];
  count: number;
}

export interface RiskProfileResponse {
  maxPortfolioExposurePercent: number;
  maxAssetExposurePercent: number;
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
}

// --- Phase 3: AI Agents ---

export interface AgentReportResponse {
  runId: string;
  agentId: string;
  agentVersion: string;
  promptVersion: string;
  requestedModel: string;
  actualModel: string | null;
  asset: string;
  horizon: "SHORT" | "MEDIUM" | "LONG";
  signal: "BUY" | "SELL" | "HOLD" | "WAIT" | null;
  score: number;
  confidence: number;
  dataQuality: number;
  reasoning: string[];
  supportingEvidence: string[];
  opposingEvidence: string[];
  sourceIds: string[];
  generatedAt: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface AgentReportsResponse {
  reports: AgentReportResponse[];
  generatedAt: string;
}

// --- Phase 4: Investment Manager & Decision Gate ---

export interface TradeProposalResponse {
  status: "VALID" | "NO_ACTION" | "UNAVAILABLE" | "INVALID" | "AMBIGUOUS";
  asset: string;
  action: "BUY" | "SELL" | "HOLD" | "WAIT" | null;
  confidence: number;
  rationale: string[];
  reportIds: string[];
  suggestedRiskFraction: number | null;
  invalidationConditions: string[];
  expiresAt: string | null;
  /** v1.4: optional TradingPlan embedded in the proposal */
  tradingPlan?: import("./trading-plan.js").TradingPlanResponse;
}

export interface DecisionGateResponse {
  decision: "APPROVE" | "BLOCK" | "MANUAL_REVIEW";
  reason: string;
  ruleCode?: string;
  proposal: TradeProposalResponse | null;
}

// --- Phase 5: Memory & Evaluation ---

export interface AgentMetricsResponse {
  agentId: string;
  totalReports: number;
  validCount: number;
  unavailableCount: number;
  invalidCount: number;
  validJsonRate: number;
  fallbackRate: number;
  avgLatencyMs: number;
  totalCostUsd: number;
  avgConfidence: number;
  avgScore: number;
  signalDistribution: Record<string, number>;
  modelAccuracy: number;
}

export interface SystemStatsResponse {
  totalAgentReports: number;
  totalProposals: number;
  totalRiskDecisions: number;
  approvedCount: number;
  blockedCount: number;
  totalAiCostUsd: number;
  reportStatusBreakdown: Record<string, number>;
  proposalStatusBreakdown: Record<string, number>;
}

// --- v1.4: Trading Plan ---
export {
  TradingPlanSchema,
  StrategySchema,
  UrgencySchema,
} from "./trading-plan.js";
export type { TradingPlan } from "./trading-plan.js";

export const CONTRACT_VERSION = "m6-contracts-v1";

// --- v1.4: Market Opportunity Score ---
export {
  OpportunityClassificationSchema,
  MarketOpportunityScoreSchema,
  DirectionalQuantitativeScoreSchema,
  OPPORTUNITY_THRESHOLDS,
  classifyOpportunity,
} from "./opportunity-score.js";
export type {
  OpportunityClassification,
  MarketOpportunityScore,
  MarketOpportunityScoreResponse,
  DirectionalQuantitativeScore,
} from "./opportunity-score.js";

// --- v1.4: Operating Mode ---
export {
  OperatingModeSchema,
  AutoApprovalRuleSchema,
  DEFAULT_AUTO_APPROVAL_RULES,
} from "./operating-mode.js";
export type {
  OperatingMode,
  AutoApprovalRule,
  OperatingModeConfigResponse,
} from "./operating-mode.js";

// --- v1.4: AI Decision Memory ---
export {
  MemoryCheckpointSchema,
  MemoryOutcomeSchema,
  AIDecisionMemorySchema,
  CHECKPOINT_TIMINGS,
} from "./ai-memory.js";
export type {
  MemoryCheckpoint,
  MemoryOutcome,
  AIDecisionMemory,
  AIDecisionMemoryResponse,
} from "./ai-memory.js";

// --- Dashboard 2.0 KPI types (v1.4 Section 8) ---

export interface DashboardKpiResponse {
  equity: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  roi: number;
  winRate: number | null;
  profitFactor: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number | null;
  aiStatus: "ACTIVE" | "IDLE" | "ERROR";
  operatingMode: "PAPER" | "ASSISTED" | "AUTONOMOUS";
}

export interface DashboardChartPoint {
  timestamp: string;
  equity: number;
}

export interface DashboardTimelineEvent {
  id: string;
  type: "TRADE_OPEN" | "TRADE_CLOSE" | "STOP_LOSS" | "TAKE_PROFIT" | "AI_DECISION" | "NEWS" | "WHALE" | "SYSTEM";
  asset?: string;
  description: string;
  amount?: number;
  timestamp: string;
}

export interface DashboardAgentStatus {
  agentId: string;
  label: string;
  status: "GREEN" | "YELLOW" | "RED";
  lastReportAt: string | null;
  modelUsed: string | null;
}

export interface DashboardAiCostEntry {
  agentId: string;
  label: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  avgLatencyMs: number;
}

export interface DashboardAiCostSummary {
  totalCostUsd: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgLatencyMs: number;
  budgetRemainingUsd: number | null;
  byAgent: DashboardAiCostEntry[];
}
