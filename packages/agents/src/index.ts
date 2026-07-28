// Phase 3 — AI Agents
// All agents produce AgentReports. No agent can call OpenRouter directly.
// No agent has access to orders or capital.

export { BaseAgent } from "./base-agent.js";
export type { BaseAgentConfig, AgentRunContext } from "./base-agent.js";

export { AgentOrchestrator } from "./orchestrator.js";
export type { AgentRunResult, OrchestratorConfig } from "./orchestrator.js";

export {
  AgentReportSchema,
  AgentReportStatusSchema,
  TradeSignalSchema,
  HorizonSchema,
  unavailableReport,
  invalidReport,
} from "./agent-report.js";
export type { AgentReport, AgentReportStatus, TradeSignal, Horizon } from "./agent-report.js";

// Agents
export { TechnicalAgent } from "./agents/technical.js";
export type { TechnicalAgentInput } from "./agents/technical.js";

export { MacroAgent } from "./agents/macro.js";
export type { MacroAgentInput } from "./agents/macro.js";

export { NewsAgent } from "./agents/news.js";
export type { NewsAgentInput } from "./agents/news.js";

export { SentimentAgent } from "./agents/sentiment.js";
export type { SentimentAgentInput } from "./agents/sentiment.js";

export { WhaleAgent } from "./agents/whale.js";
export type { WhaleAgentInput } from "./agents/whale.js";

// Investment Manager (Phase 4)
export { ManagerAgent } from "./agents/manager.js";
export type { ManagerAgentInput } from "./agents/manager.js";
