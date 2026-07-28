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
