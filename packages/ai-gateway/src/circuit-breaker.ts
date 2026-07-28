import type { CircuitBreakerConfig, CircuitState } from "./types.js";

/**
 * Deterministic Circuit Breaker.
 *
 * Prevents cascading failures by stopping calls to a provider
 * when it consistently fails. States:
 * - CLOSED: normal operation
 * - OPEN: all calls blocked
 * - HALF_OPEN: limited calls allowed to test recovery
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private openTime: number | null = null;
  private halfOpenCallsRemaining = 0;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeoutMs: config.resetTimeoutMs,
      halfOpenMaxCalls: config.halfOpenMaxCalls,
    };
  }

  get currentState(): CircuitState {
    this.checkState();
    return this.state;
  }

  /** Called before making a request. Returns true if the call is allowed. */
  allowCall(): boolean {
    this.checkState();

    switch (this.state) {
      case "CLOSED":
        return true;
      case "OPEN":
        return false;
      case "HALF_OPEN":
        if (this.halfOpenCallsRemaining > 0) {
          this.halfOpenCallsRemaining--;
          return true;
        }
        return false;
    }
  }

  /** Record a successful call */
  success(): void {
    this.reset();
  }

  /** Record a failed call. Returns the new state. */
  failure(): CircuitState {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.state === "CLOSED" &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.state = "OPEN";
      this.openTime = Date.now();
    }

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openTime = Date.now();
      this.halfOpenCallsRemaining = 0;
    }

    return this.state;
  }

  /** Reset the circuit breaker to CLOSED state */
  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.openTime = null;
    this.halfOpenCallsRemaining = 0;
  }

  private checkState(): void {
    if (this.state === "OPEN" && this.openTime !== null) {
      const elapsed = Date.now() - this.openTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.halfOpenCallsRemaining = this.config.halfOpenMaxCalls;
      }
    }
  }
}

