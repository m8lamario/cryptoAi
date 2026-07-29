import { z } from "zod";

// --- AI Provider Interface ---

/** Options for a single model call */
export interface ModelCallOptions {
  /** Model identifier (e.g., "deepseek/deepseek-v4-flash") */
  model: string;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Temperature (0-2) */
  temperature?: number;
  /** Reasoning effort level */
  reasoning?: "low" | "medium" | "high" | "xhigh";
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum retries on transient errors */
  maxRetries?: number;
}

/** Structured usage statistics */
export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
}

/** Result of a model call */
export interface ModelCallResult {
  /** Raw text content from the model */
  content: string;
  /** The model that actually served the request */
  actualModel: string;
  /** Usage statistics */
  usage: UsageStats;
  /** Whether this was a fallback call */
  fallback: boolean;
}

/** Possible error categories */
export const AIErrorCategorySchema = z.enum([
  "TIMEOUT",
  "RATE_LIMIT",
  "PAYMENT_REQUIRED",
  "SERVER_ERROR",
  "INVALID_RESPONSE",
  "CIRCUIT_OPEN",
  "BUDGET_EXCEEDED",
  "VALIDATION_FAILED",
  "UNKNOWN",
]);

export type AIErrorCategory = z.infer<typeof AIErrorCategorySchema>;

/** Structured AI error */
export interface AIError {
  category: AIErrorCategory;
  message: string;
  statusCode?: number;
  retryable: boolean;
  cause?: unknown;
}

// --- AIProvider Interface ---

/** Common interface for all AI providers */
export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;

  /**
   * Send a completion request to the AI provider.
   * Returns structured output (text + metadata).
   * Throws AIError on failure.
   */
  complete(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<ModelCallOptions>,
  ): Promise<ModelCallResult>;
}

// --- Circuit Breaker ---

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

// --- Budget ---

export interface BudgetConfig {
  /** Max daily spend in USD */
  maxDailyUsd: number;
  /** Max monthly spend in USD */
  maxMonthlyUsd: number;
}

// --- Gateway Config ---

export interface AIGatewayConfig {
  provider: AIProvider;
  circuitBreaker?: CircuitBreakerConfig;
  budget?: BudgetConfig;
  /** Default timeout per call (ms) */
  defaultTimeoutMs?: number;
  /** Default max retries */
  defaultMaxRetries?: number;
  /** Default temperature */
  defaultTemperature?: number;
  /** Default max output tokens */
  defaultMaxTokens?: number;
}

// --- Gateway Call Options ---

export interface GatewayCallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  reasoning?: "low" | "medium" | "high" | "xhigh";
  timeoutMs?: number;
  maxRetries?: number;
}

// --- Gateway Response ---

export interface GatewayResponse<T> {
  status: "VALID" | "UNAVAILABLE" | "INVALID";
  data: T | null;
  usage: UsageStats | null;
  error?: AIError;
  requestedModel: string;
  actualModel: string | null;
  promptVersion: string;
  schemaVersion: string;
  runId: string;
  generatedAt: string;
}

