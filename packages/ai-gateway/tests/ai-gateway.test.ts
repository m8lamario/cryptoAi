import { describe, it, expect } from "vitest";
import { z } from "zod";
import { AIGateway } from "../src/ai-gateway.js";
import { MockAIProvider } from "../src/mock-provider.js";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
});

describe("AIGateway — structured call", () => {
  it("returns VALID with parsed data", async () => {
    const mock = new MockAIProvider([
      '{"name": "Alice", "age": 30}',
    ]);
    const gateway = new AIGateway({
      provider: mock,
      defaultTemperature: 0.3,
      defaultMaxTokens: 500,
    });

    const response = await gateway.structuredCall(
      "You are a test assistant",
      "Return a person JSON",
      PersonSchema,
    );

    expect(response.status).toBe("VALID");
    expect(response.data).toEqual({ name: "Alice", age: 30 });
    expect(response.usage).not.toBeNull();
    expect(response.usage!.promptTokens).toBe(100);
    expect(response.usage!.completionTokens).toBe(50);
    expect(response.usage!.estimatedCostUsd).toBe(0.00005);
    expect(response.requestedModel).toBe("mock/model");
    expect(response.actualModel).toBe("mock/model");
    expect(response.runId).toBeTruthy();
    expect(response.promptVersion).toBe("1.0.0");
    expect(response.schemaVersion).toBe("1.0.0");
  });

  it("extracts JSON from markdown code fences", async () => {
    const mock = new MockAIProvider([
      '```json\n{"name": "Bob", "age": 25}\n```',
    ]);
    const gateway = new AIGateway({ provider: mock });

    const response = await gateway.structuredCall(
      "Test",
      "Test",
      PersonSchema,
    );

    expect(response.status).toBe("VALID");
    expect(response.data).toEqual({ name: "Bob", age: 25 });
  });

  it("returns INVALID on schema mismatch", async () => {
    const mock = new MockAIProvider(['{"name": 123, "age": "not-a-number"}']);
    const gateway = new AIGateway({ provider: mock });

    const response = await gateway.structuredCall(
      "Test",
      "Test",
      PersonSchema,
    );

    expect(response.status).toBe("INVALID");
    expect(response.data).toBeNull();
    expect(response.error?.category).toBe("VALIDATION_FAILED");
  });

  it("returns INVALID on non-JSON output", async () => {
    const mock = new MockAIProvider(["Just some text, not JSON"]);
    const gateway = new AIGateway({ provider: mock });

    const response = await gateway.structuredCall(
      "Test",
      "Test",
      PersonSchema,
    );

    expect(response.status).toBe("INVALID");
    expect(response.error?.category).toBe("VALIDATION_FAILED");
  });

  it("returns UNAVAILABLE on provider failure", async () => {
    const mock = new MockAIProvider(['{"name": "A", "age": 1}']);
    mock.setShouldFail(true);
    const gateway = new AIGateway({
      provider: mock,
      defaultMaxRetries: 0,
    });

    const response = await gateway.structuredCall(
      "Test",
      "Test",
      PersonSchema,
    );

    expect(response.status).toBe("UNAVAILABLE");
    expect(response.data).toBeNull();
  });
});

describe("AIGateway — circuit breaker", () => {
  it("opens circuit after repeated failures", async () => {
    const mock = new MockAIProvider();
    mock.setShouldFail(true);
    const gateway = new AIGateway({
      provider: mock,
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeoutMs: 60_000,
        halfOpenMaxCalls: 1,
      },
      defaultMaxRetries: 0,
    });

    // First call — fails, circuit still CLOSED
    const r1 = await gateway.structuredCall("T", "T", PersonSchema);
    expect(r1.status).toBe("UNAVAILABLE");

    // Second call — fails, circuit opens
    const r2 = await gateway.structuredCall("T", "T", PersonSchema);
    expect(r2.status).toBe("UNAVAILABLE");

    // Third call — circuit OPEN, immediate rejection
    const r3 = await gateway.structuredCall("T", "T", PersonSchema);
    expect(r3.status).toBe("UNAVAILABLE");
    expect(r3.error?.category).toBe("CIRCUIT_OPEN");
  });
});

describe("AIGateway — budget", () => {
  it("blocks when budget exceeded", async () => {
    const mock = new MockAIProvider(['{"name": "X", "age": 1}']);
    const gateway = new AIGateway({
      provider: mock,
      budget: {
        maxDailyUsd: 0.00001,
        maxMonthlyUsd: 1.0,
      },
    });

    // First call should succeed but consume budget
    const r1 = await gateway.structuredCall("T", "T", PersonSchema);
    // The mock cost is 0.00005, which exceeds 0.00001 daily
    // So it should be UNAVAILABLE with budget exceeded
    expect(r1.status).toBe("UNAVAILABLE");
    expect(r1.error?.category).toBe("BUDGET_EXCEEDED");
  });
});

describe("AIGateway — custom prompt/schema versions", () => {
  it("records prompt and schema versions", async () => {
    const mock = new MockAIProvider(['{"name": "V", "age": 1}']);
    const gateway = new AIGateway({ provider: mock });

    const response = await gateway.structuredCall(
      "S",
      "U",
      PersonSchema,
      {},
      "2.0.0",
      "3.1.0",
    );

    expect(response.status).toBe("VALID");
    expect(response.promptVersion).toBe("2.0.0");
    expect(response.schemaVersion).toBe("3.1.0");
  });
});

