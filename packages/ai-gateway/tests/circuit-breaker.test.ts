import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../src/circuit-breaker.js";

describe("CircuitBreaker", () => {
  const config = {
    failureThreshold: 2,
    resetTimeoutMs: 500,
    halfOpenMaxCalls: 1,
  };

  it("starts CLOSED and allows calls", () => {
    const cb = new CircuitBreaker(config);
    expect(cb.currentState).toBe("CLOSED");
    expect(cb.allowCall()).toBe(true);
  });

  it("opens after reaching failure threshold", () => {
    const cb = new CircuitBreaker(config);
    cb.failure();
    expect(cb.currentState).toBe("CLOSED");
    cb.failure();
    expect(cb.currentState).toBe("OPEN");
    expect(cb.allowCall()).toBe(false);
  });

  it("transitions to HALF_OPEN after reset timeout", async () => {
    const cb = new CircuitBreaker({ ...config, resetTimeoutMs: 50 });
    cb.failure();
    cb.failure();
    expect(cb.currentState).toBe("OPEN");

    // Wait for reset timeout
    await sleep(60);

    expect(cb.currentState).toBe("HALF_OPEN");
    expect(cb.allowCall()).toBe(true); // First half-open call allowed
    expect(cb.allowCall()).toBe(false); // Second call blocked (halfOpenMaxCalls=1)
  });

  it("returns to CLOSED on success in HALF_OPEN", async () => {
    const cb = new CircuitBreaker({ ...config, resetTimeoutMs: 50 });
    cb.failure();
    cb.failure();
    await sleep(60);
    expect(cb.currentState).toBe("HALF_OPEN");

    cb.allowCall(); // consume the allowed call
    cb.success();
    expect(cb.currentState).toBe("CLOSED");
  });

  it("returns to OPEN on failure in HALF_OPEN", async () => {
    const cb = new CircuitBreaker({ ...config, resetTimeoutMs: 50 });
    cb.failure();
    cb.failure();
    await sleep(60);
    expect(cb.currentState).toBe("HALF_OPEN");

    cb.allowCall(); // consume the allowed call
    cb.failure();
    expect(cb.currentState).toBe("OPEN");
  });

  it("reset() sets state to CLOSED", () => {
    const cb = new CircuitBreaker(config);
    cb.failure();
    cb.failure();
    expect(cb.currentState).toBe("OPEN");
    cb.reset();
    expect(cb.currentState).toBe("CLOSED");
    expect(cb.allowCall()).toBe(true);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

