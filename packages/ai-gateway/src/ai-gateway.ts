import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  AIGatewayConfig,
  GatewayCallOptions,
  GatewayResponse,
  AIError,
} from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { BudgetTracker } from "./budget-tracker.js";

/**
 * AI Gateway — the single entry point for all AI calls.
 *
 * Responsibilities:
 * - Provider abstraction (OpenRouter, mock, etc.)
 * - Circuit breaker for fault tolerance
 * - Budget enforcement (daily + monthly)
 * - Retry with exponential backoff
 * - Zod output validation
 * - Structured GatewayResponse (never throws)
 * - Logging of token usage, cost, latency, model
 */
export class AIGateway {
  private readonly config: AIGatewayConfig;
  private readonly circuitBreaker: CircuitBreaker | null;
  private readonly budgetTracker: BudgetTracker | null;

  constructor(config: AIGatewayConfig) {
    this.config = config;

    if (config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    } else {
      this.circuitBreaker = null;
    }

    if (config.budget) {
      this.budgetTracker = new BudgetTracker(config.budget);
    } else {
      this.budgetTracker = null;
    }
  }

  /**
   * Make a structured AI call with Zod validation.
   *
   * @param systemPrompt - System prompt/persona
   * @param userPrompt - User prompt with data context
   * @param outputSchema - Zod schema for output validation
   * @param options - Call options (model, temperature, etc.)
   * @param promptVersion - Version label for the prompt (audit trail)
   * @param schemaVersion - Version label for the schema (audit trail)
   *
   * @returns GatewayResponse<T> — always returns, never throws
   */
  async structuredCall<T>(
    systemPrompt: string,
    userPrompt: string,
    outputSchema: z.ZodType<T>,
    options: GatewayCallOptions = {},
    promptVersion = "1.0.0",
    schemaVersion = "1.0.0",
  ): Promise<GatewayResponse<T>> {
    const runId = randomUUID();
    const generatedAt = new Date().toISOString();
    const requestedModel = options.model ?? this.config.provider.defaultModel;

    // 1. Circuit breaker check
    if (this.circuitBreaker && !this.circuitBreaker.allowCall()) {
      const error: AIError = {
        category: "CIRCUIT_OPEN",
        message: "Circuit breaker is open — too many failures",
        retryable: true,
      };
      return {
        status: "UNAVAILABLE",
        data: null,
        usage: null,
        error,
        requestedModel,
        actualModel: null,
        promptVersion,
        schemaVersion,
        runId,
        generatedAt,
      };
    }

    // 2. Budget check
    if (this.budgetTracker && !this.budgetTracker.canSpend(0.01)) {
      const error: AIError = {
        category: "BUDGET_EXCEEDED",
        message: `Budget exceeded: daily=${this.budgetTracker.getDailySpent().toFixed(4)}, monthly=${this.budgetTracker.getMonthlySpent().toFixed(4)}`,
        retryable: false,
      };
      return {
        status: "UNAVAILABLE",
        data: null,
        usage: null,
        error,
        requestedModel,
        actualModel: null,
        promptVersion,
        schemaVersion,
        runId,
        generatedAt,
      };
    }

    const maxRetries = options.maxRetries ?? this.config.defaultMaxRetries ?? 2;
    let lastError: AIError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Wait on retry (exponential backoff)
        if (attempt > 0) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          await sleep(delayMs);
        }

        const result = await this.config.provider.complete(
          systemPrompt,
          userPrompt,
          {
            model: options.model,
            temperature: options.temperature ?? this.config.defaultTemperature,
            maxTokens: options.maxTokens ?? this.config.defaultMaxTokens,
            reasoning: options.reasoning,
            timeoutMs: options.timeoutMs ?? this.config.defaultTimeoutMs,
          },
        );

        // Budget: check if we can afford this call
        if (
          this.budgetTracker &&
          !this.budgetTracker.canSpend(result.usage.estimatedCostUsd)
        ) {
          const error: AIError = {
            category: "BUDGET_EXCEEDED",
            message: "Budget would be exceeded by this call cost",
            retryable: false,
          };
          return {
            status: "UNAVAILABLE",
            data: null,
            usage: result.usage,
            error,
            requestedModel,
            actualModel: result.actualModel,
            promptVersion,
            schemaVersion,
            runId,
            generatedAt,
          };
        }

        // Record spend
        if (this.budgetTracker) {
          this.budgetTracker.record(result.usage.estimatedCostUsd);
        }

        // Parse and validate JSON output
        try {
          // Try to extract JSON from content (may be wrapped in markdown)
          const jsonContent = extractJson(result.content);
          const parsed = JSON.parse(jsonContent) as unknown;
          const validated = outputSchema.parse(parsed);

          // Circuit breaker success
          if (this.circuitBreaker) {
            this.circuitBreaker.success();
          }

          return {
            status: "VALID",
            data: validated,
            usage: result.usage,
            requestedModel,
            actualModel: result.actualModel,
            promptVersion,
            schemaVersion,
            runId,
            generatedAt,
          };
        } catch (parseErr) {
          const error: AIError = {
            category: "VALIDATION_FAILED",
            message: parseErr instanceof Error
              ? `Output validation failed: ${parseErr.message}`
              : "Output validation failed",
            retryable: false,
            cause: parseErr,
          };

          // Invalid output is not retryable — it's a model quality issue
          return {
            status: "INVALID",
            data: null,
            usage: result.usage,
            error,
            requestedModel,
            actualModel: result.actualModel,
            promptVersion,
            schemaVersion,
            runId,
            generatedAt,
          };
        }
      } catch (err) {
        const aiError: AIError =
          err && typeof err === "object" && "category" in err
            ? (err as AIError)
            : {
                category: "UNKNOWN",
                message: err instanceof Error ? err.message : "Unknown error",
                retryable: false,
                cause: err,
              };

        lastError = aiError;

        // If the error is not retryable, stop here
        if (!aiError.retryable) {
          break;
        }

        // Otherwise, continue to next retry attempt
      }
    }

    // All attempts failed
    if (this.circuitBreaker) {
      this.circuitBreaker.failure();
    }

    return {
      status: "UNAVAILABLE",
      data: null,
      usage: null,
      error: lastError ?? {
        category: "UNKNOWN",
        message: "All retries exhausted",
        retryable: false,
      },
      requestedModel,
      actualModel: null,
      promptVersion,
      schemaVersion,
      runId,
      generatedAt,
    };
  }

  // --- Budget read access for monitoring ---

  getDailySpent(): number {
    return this.budgetTracker?.getDailySpent() ?? 0;
  }

  getMonthlySpent(): number {
    return this.budgetTracker?.getMonthlySpent() ?? 0;
  }

  getDailyRemaining(): number {
    return this.budgetTracker?.getDailyRemaining() ?? 0;
  }

  getMonthlyRemaining(): number {
    return this.budgetTracker?.getMonthlyRemaining() ?? 0;
  }

  getCircuitState(): string | null {
    return this.circuitBreaker?.currentState ?? null;
  }
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract JSON from content that might be wrapped in markdown code fences.
 */
function extractJson(content: string): string {
  // Try to find JSON in ```json ... ``` blocks first
  const jsonBlock = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlock?.[1]) {
    const inner = jsonBlock[1].trim();
    // Also try balanced extraction inside the code block
    const balanced = extractBalancedJson(inner);
    if (balanced) return balanced;
    return inner;
  }

  // Try balanced brace extraction from the raw content
  const balanced = extractBalancedJson(content);
  if (balanced) return balanced;

  // Fallback: find first { and last } (non-greedy version)
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1).trim();
  }

  return content.trim();
}

/**
 * Extract the first balanced JSON object from a string.
 * Returns null if no balanced object is found.
 */
function extractBalancedJson(content: string): string | null {
  const startIdx = content.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return content.slice(startIdx, i + 1).trim();
      }
    }
  }

  return null;
}
