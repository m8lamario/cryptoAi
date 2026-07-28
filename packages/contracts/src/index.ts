// Technical shared contracts – Fase 0 + Fase 1
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
}

export interface DecisionGateResponse {
  decision: "APPROVE" | "BLOCK" | "MANUAL_REVIEW";
  reason: string;
  ruleCode?: string;
  proposal: TradeProposalResponse | null;
}
