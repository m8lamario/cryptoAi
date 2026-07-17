// Technical shared contracts – Fase 0
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
