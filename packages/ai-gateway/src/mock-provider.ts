import type { AIProvider, ModelCallOptions, ModelCallResult } from "./types.js";

/**
 * Mock AI Provider for testing.
 * Returns deterministic outputs — no real API calls.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly defaultModel = "mock/model";

  private readonly responses: string[];
  private callCount = 0;
  private shouldFail = false;
  private failAfterCalls = 0;

  constructor(responses?: string[]) {
    this.responses = responses ?? ['{"signal": "HOLD", "score": 0}'];
  }

  /** Configure to fail after N successful calls */
  setFailAfterCalls(count: number): void {
    this.failAfterCalls = count;
  }

  /** Make next call throw an error */
  setShouldFail(value: boolean): void {
    this.shouldFail = value;
  }

  /** Get the number of calls made so far */
  getCallCount(): number {
    return this.callCount;
  }

  /** Reset call count */
  reset(): void {
    this.callCount = 0;
    this.shouldFail = false;
    this.failAfterCalls = 0;
  }

  async complete(
    _systemPrompt: string,
    _userPrompt: string,
    _options?: Partial<ModelCallOptions>,
  ): Promise<ModelCallResult> {
    if (this.shouldFail || (this.failAfterCalls > 0 && this.callCount >= this.failAfterCalls)) {
      this.callCount++;
      throw {
        category: "SERVER_ERROR",
        message: "Mock provider configured to fail",
        statusCode: 500,
        retryable: true,
      };
    }

    this.callCount++;

    // Cycle through responses
    const content =
      this.responses[this.callCount % this.responses.length] ??
      this.responses[this.responses.length - 1] ??
      "{}";

    return {
      content,
      actualModel: "mock/model",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 10,
        estimatedCostUsd: 0.00005,
      },
      fallback: false,
    };
  }
}

