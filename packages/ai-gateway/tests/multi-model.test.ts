import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MultiModelGateway } from "../src/multi-model.js";
import type { MultiModelConfig } from "../src/multi-model.js";
import { AIGateway } from "../src/ai-gateway.js";
import { MockAIProvider } from "../src/mock-provider.js";
import type { AIGatewayConfig } from "../src/types.js";

/** Loose schema that accepts any JSON object */
const AnySchema = z.object({}).passthrough();

function makeGatewayConfig(responses: string[]): AIGatewayConfig {
  return {
    provider: new MockAIProvider(responses),
    defaultTemperature: 0.3,
    defaultMaxTokens: 500,
  };
}

describe("MultiModelGateway — SINGLE mode", () => {
  it("passthrough to primary model", async () => {
    const config: MultiModelConfig = {
      mode: "SINGLE",
      primary: { role: "primary", model: "mock/model-a" },
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig(['{"action":"BUY","confidence":0.8}'])],
    ]));

    const result = await gateway.structuredCall("sys", "user", AnySchema);
    expect(result.status).toBe("VALID");
  });

  it("returns UNAVAILABLE when primary fails", async () => {
    const mock = new MockAIProvider(["{}"]);
    mock.setShouldFail(true);

    const config: MultiModelConfig = {
      mode: "SINGLE",
      primary: { role: "primary", model: "mock/model" },
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", { provider: mock, defaultTemperature: 0.3 }],
    ]));

    const result = await gateway.structuredCall("s", "u", AnySchema);
    expect(result.status).toBe("UNAVAILABLE");
  });
});

describe("MultiModelGateway — SECOND_OPINION mode", () => {
  const agreeJson = '{"signal":"BUY","score":0.7,"confidence":0.8}';
  const disagreeJson = '{"signal":"SELL","score":-0.7,"confidence":0.8}';

  it("runs both models and returns primary when they agree", async () => {
    const config: MultiModelConfig = {
      mode: "SECOND_OPINION",
      primary: { role: "primary", model: "mock/a" },
      secondary: { role: "secondary", model: "mock/b" },
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig([agreeJson])],
      ["secondary", makeGatewayConfig([agreeJson])],
    ]));

    const result = await gateway.structuredCall("s", "u", AnySchema);
    expect(result.status).toBe("VALID");
    const data = result.data as Record<string, unknown> | null;
    expect(data?.["_secondOpinionAgrees"]).toBe(true);
  });

  it("detects disagreement between models", async () => {
    const config: MultiModelConfig = {
      mode: "SECOND_OPINION",
      primary: { role: "primary", model: "mock/a" },
      secondary: { role: "secondary", model: "mock/b" },
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig([agreeJson])],
      ["secondary", makeGatewayConfig([disagreeJson])],
    ]));

    const result = await gateway.structuredCall("s", "u", AnySchema);
    expect(result.status).toBe("VALID");
    const data = result.data as Record<string, unknown> | null;
    expect(data?.["_secondOpinionAgrees"]).toBe(false);
  });

  it("falls back to secondary when primary is unavailable", async () => {
    const primaryMock = new MockAIProvider(["{}"]);
    primaryMock.setShouldFail(true);

    const config: MultiModelConfig = {
      mode: "SECOND_OPINION",
      primary: { role: "primary", model: "mock/a" },
      secondary: { role: "secondary", model: "mock/b" },
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", { provider: primaryMock, defaultTemperature: 0.3 }],
      ["secondary", makeGatewayConfig([agreeJson])],
    ]));

    const result = await gateway.structuredCall("s", "u", AnySchema);
    expect(result.status).toBe("VALID");
  });
});

describe("MultiModelGateway — CONSENSUS mode", () => {
  const buyJson = '{"action":"BUY","confidence":0.8}';
  const sellJson = '{"action":"SELL","confidence":0.8}';

  it("returns VALID when all 3 models agree", async () => {
    const config: MultiModelConfig = {
      mode: "CONSENSUS",
      primary: { role: "primary", model: "mock/a" },
      secondary: { role: "secondary", model: "mock/b" },
      additional: [{ role: "tertiary", model: "mock/c" }],
      consensusMinAgreement: 2,
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig([buyJson])],
      ["secondary", makeGatewayConfig([buyJson])],
      ["tertiary", makeGatewayConfig([buyJson])],
    ]));

    const result = await gateway.structuredCall("s", "u", AnySchema);
    expect(result.status).toBe("VALID");
    const data = result.data as Record<string, unknown> | null;
    expect(data?.action).toBe("BUY");
  });

  it("returns UNAVAILABLE when no consensus (all 3 disagree)", async () => {
    const config: MultiModelConfig = {
      mode: "CONSENSUS",
      primary: { role: "primary", model: "mock/a" },
      secondary: { role: "secondary", model: "mock/b" },
      additional: [{ role: "tertiary", model: "mock/c" }],
      consensusMinAgreement: 2,
    };

    const jsonA = '{"action":"BUY","confidence":0.8}';
    const jsonB = '{"action":"SELL","confidence":0.8}';
    const jsonC = '{"action":"HOLD","confidence":0.8}';

    // 3 different actions — no 2 agree
    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig([jsonA])],
      ["secondary", makeGatewayConfig([jsonB])],
      ["tertiary", makeGatewayConfig([jsonC])],
    ]));

    const result = await gateway.structuredCall("s", "u", AnySchema);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.error?.message).toContain("largest agreement group");
  });

  it("returns VALID with majority agreement (2/3 agree)", async () => {
    const config: MultiModelConfig = {
      mode: "CONSENSUS",
      primary: { role: "primary", model: "mock/a" },
      secondary: { role: "secondary", model: "mock/b" },
      additional: [{ role: "tertiary", model: "mock/c" }],
      consensusMinAgreement: 2,
    };

    // primary and secondary agree (BUY), tertiary disagrees (SELL)
    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig([buyJson])],
      ["secondary", makeGatewayConfig([buyJson])],
      ["tertiary", makeGatewayConfig([sellJson])],
    ]));

    const result = await gateway.structuredCall("s", "u", AnySchema);
    expect(result.status).toBe("VALID");
    const data = result.data as Record<string, unknown> | null;
    expect(data?.action).toBe("BUY");
  });
});

describe("MultiModelGateway — budget delegation", () => {
  it("getDailySpent delegates to primary", () => {
    const config: MultiModelConfig = {
      mode: "SINGLE",
      primary: { role: "primary", model: "mock/a" },
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig(["{}"])],
    ]));

    expect(gateway.getDailySpent()).toBe(0);
  });

  it("getMonthlySpent delegates to primary", () => {
    const config: MultiModelConfig = {
      mode: "SINGLE",
      primary: { role: "primary", model: "mock/a" },
    };

    const gateway = new MultiModelGateway(config, new Map([
      ["primary", makeGatewayConfig(["{}"])],
    ]));

    expect(gateway.getMonthlySpent()).toBe(0);
  });
});
