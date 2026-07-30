import type {
  AIProvider,
  ModelCallOptions,
  ModelCallResult,
  AIError,
  AIErrorCategory,
  UsageStats,
} from "./types.js";

export interface OpenRouterConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Base URL for OpenRouter API (default: https://openrouter.ai/api/v1) */
  baseUrl?: string;
  /** App title for OpenRouter header (optional) */
  appTitle?: string;
  /** HTTP referer for OpenRouter header (optional) */
  httpReferer?: string;
  /** Default model to use if none specified */
  defaultModel?: string;
}

/**
 * OpenRouter AI Provider implementation.
 * Uses the OpenRouter API (OpenAI-compatible chat completions).
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1";
    this.defaultModel = config.defaultModel ?? "deepseek/deepseek-v4-flash";

    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    if (config.appTitle) {
      this.headers["X-Title"] = config.appTitle;
    }
    if (config.httpReferer) {
      this.headers["HTTP-Referer"] = config.httpReferer;
    }
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<ModelCallOptions>,
  ): Promise<ModelCallResult> {
    const model = options?.model ?? this.defaultModel;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 1500;
    const timeoutMs = options?.timeoutMs ?? 60000;

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    };

    // Add reasoning if specified
    if (options?.reasoning) {
      body["reasoning"] = { effort: options.reasoning };
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw await this.handleHttpError(response);
      }

      const data = (await response.json()) as {
        id: string;
        model: string;
        choices: Array<{ message: { content: string; role: string } }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const content = data.choices[0]?.message?.content ?? "";
      const actualModel = data.model ?? model;

      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;

      // Estimate cost: pricing varies by model. Use a conservative estimate.
      const estimatedCostUsd = this.estimateCost(model, promptTokens, completionTokens);

      const usage: UsageStats = {
        promptTokens,
        completionTokens,
        latencyMs,
        estimatedCostUsd,
      };

      return {
        content,
        actualModel,
        usage,
        fallback: model !== actualModel,
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;

      if (err && typeof err === "object" && "category" in err) {
        throw err; // Already an AIError
      }

      const error = this.wrapError(err);
      throw error;
    }
  }

  private async handleHttpError(response: Response): Promise<AIError> {
    let message = `OpenRouter HTTP ${response.status}`;
    let category: AIErrorCategory = "UNKNOWN";
    let retryable = false;

    try {
      const body = (await response.json()) as {
        error?: { message?: string; code?: number };
      };
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // Use raw status text if body can't be parsed
      message = response.statusText || message;
    }

    switch (response.status) {
      case 408:
        category = "TIMEOUT";
        retryable = true;
        break;
      case 429:
        category = "RATE_LIMIT";
        retryable = true;
        break;
      case 402:
        category = "PAYMENT_REQUIRED";
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        category = "SERVER_ERROR";
        retryable = true;
        break;
    }

    return {
      category,
      message,
      statusCode: response.status,
      retryable,
    };
  }

  private wrapError(err: unknown): AIError {
    if (err && typeof err === "object" && "category" in err) {
      return err as AIError;
    }

    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        category: "TIMEOUT",
        message: "Request timed out",
        retryable: true,
        cause: err,
      };
    }

    return {
      category: "UNKNOWN",
      message: err instanceof Error ? err.message : "Unknown error",
      retryable: false,
      cause: err,
    };
  }

  /**
   * Estimate cost in USD based on prompt + completion tokens.
   * Uses conservative pricing; actual costs depend on OpenRouter's current pricing.
   *
   * DeepSeek V4 Pro: ~$0.20/M input, ~$0.40/M output (rough estimate)
   * We use a slightly higher estimate for safety.
   */
  private estimateCost(
    _model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    // Conservative blended rate: ~$0.30/M for input, ~$0.50/M for output
    const inputCost = (promptTokens / 1_000_000) * 0.3;
    const outputCost = (completionTokens / 1_000_000) * 0.5;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // round to 6 decimals
  }
}
