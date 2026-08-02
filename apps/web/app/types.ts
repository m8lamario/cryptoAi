import type {
  DashboardAgentStatus,
  DashboardAiCostSummary,
  DashboardChartPoint,
  DashboardKpiResponse,
  DashboardTimelineEvent,
} from "@cryptoai/contracts";

// --- M5: Scanner types ---

export interface OpportunityScoreData {
  asset: string;
  score: number;
  classification: string;
  components: { name: string; value: number; weight: number }[];
  evaluatedAt: string;
  change24h?: number | null;
  price?: number | null;
  volume24h?: number | null;
}

export interface ScannerConfigData {
  maxAssetsToScan: number;
  maxAssetsForQuant: number;
  maxAssetsForAI: number;
  minScoreForAI: number;
  scannerFrequencyMinutes: number;
  minVolume24hUsd: number;
  minMarketCapUsd: number;
}

export interface WatchlistAssetData {
  symbol: string;
  active: boolean;
  isPinned: boolean;
  isExcluded: boolean;
  maxCapitalUsd: number | null;
}

export interface DashboardData {
  systemStatus: { healthy: boolean; uptime: number; timestamp: string };
  marketData: {
    snapshots: Array<{
      symbol: string; price: number; change24h: number | null;
      volume24h: number | null; high24h: number | null; low24h: number | null;
      collectedAt: string;
    }>;
    collectionStatus: { id: string; status: string; startedAt: string; endedAt: string | null; provider: string; error: string | null } | null;
    assetCount: number;
  };
  agentReports: Array<{
    runId: string; agentId: string; asset: string; signal: string | null;
    score: number; confidence: number; status: string; horizon: string;
    promptTokens: number; latencyMs: number; estimatedCostUsd: number; createdAt: string;
  }>;
  proposals: Array<{
    runId: string; asset: string; action: string | null; confidence: number;
    status: string; decisionGateResult: string | null; suggestedRiskFraction: number | null;
    createdAt: string;
  }>;
  riskDecisions: Array<{
    id: string; status: string; ruleCode: string; reason: string;
    asset: string; positionSize: number | null; stopLoss: number | null; createdAt: string;
  }>;
  killSwitch: { active: boolean; reason: string | null; updatedAt: string };
  riskConfig: {
    maxPortfolioExposurePercent: number; maxAssetExposurePercent: number;
    maxDailyLossPercent: number; maxDrawdownPercent: number;
  } | null;
  aiCosts: {
    totalCostUsd: number; totalPromptTokens: number;
    totalCompletionTokens: number; avgLatencyMs: number;
    budgetRemainingUsd: number | null;
    byAgent: DashboardAiCostSummary["byAgent"];
  };
  auditLog: Array<{
    id: string; level: string; type: string; message: string; createdAt: string;
  }>;
  paperPortfolio: {
    balance: number; peakValue: number; dailyPnl: number;
    totalExposure: number; totalValue: number;
    positions: Array<{
      asset: string; side: string; quantity: number; entryPrice: number;
      currentPrice: number; unrealizedPnl: number; stopLoss: number | null;
    }>;
  };
  backtestRuns: Array<{
    id: string; strategy: string; asset: string;
    startDate: string; endDate: string; initialQuote: number;
    finalQuote: number; totalReturn: number; maxDrawdown: number;
    sharpeRatio: number | null; sortinoRatio: number | null;
    totalTrades: number; aiCostUsd: number; createdAt: string;
  }>;
  kpis: DashboardKpiResponse;
  equityHistory: DashboardChartPoint[];
  timeline: DashboardTimelineEvent[];
  agentStatuses: DashboardAgentStatus[];
  aiCostSummary: DashboardAiCostSummary;
}
