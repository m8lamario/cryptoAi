// Phase 2B — AI Gateway
// Single entry point for all AI calls. No agent calls OpenRouter directly.

export { AIGateway } from "./ai-gateway.js";
export { OpenRouterProvider } from "./openrouter-provider.js";
export { MockAIProvider } from "./mock-provider.js";
export { CircuitBreaker } from "./circuit-breaker.js";
export { BudgetTracker } from "./budget-tracker.js";
export { AIErrorCategorySchema } from "./types.js";
export { MultiModelGateway } from "./multi-model.js";
export type { MultiModelConfig, MultiModelEntry, ConsensusMode } from "./multi-model.js";

export type { OpenRouterConfig } from "./openrouter-provider.js";
export type {
  AIProvider,
  ModelCallOptions,
  ModelCallResult,
  UsageStats,
  AIError,
  AIErrorCategory,
  CircuitState,
  CircuitBreakerConfig,
  BudgetConfig,
  AIGatewayConfig,
  GatewayCallOptions,
  GatewayResponse,
} from "./types.js";
