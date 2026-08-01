import { describe, it, expect } from "vitest";
import {
  evaluateAutoApproval,
  DEFAULT_AUTO_APPROVAL_RULES,
} from "../src/auto-approval.js";
import type { TradeProposal } from "../src/types.js";

function makeProposal(overrides: Partial<TradeProposal> = {}): TradeProposal {
  return {
    status: "VALID",
    asset: "BTCUSDT",
    action: "BUY",
    confidence: 0.8,
    rationale: ["Test rationale"],
    reportIds: ["r1", "r2"],
    suggestedRiskFraction: 0.02,
    invalidationConditions: [],
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  };
}

describe("evaluateAutoApproval", () => {
  const portfolioValue = 10000;
  const rules = DEFAULT_AUTO_APPROVAL_RULES;

  it("PAPER mode always EXECUTE regardless of size", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal(),
      positionSizeQuote: 500, // 5% of portfolio
      portfolioValue,
      operatingMode: "PAPER",
      rules,
    });
    expect(result.action).toBe("EXECUTE");
  });

  it("AUTONOMOUS: small trade (0.5%) with high confidence → EXECUTE", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.85 }),
      positionSizeQuote: 50, // 0.5%
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules,
    });
    expect(result.action).toBe("EXECUTE");
  });

  it("AUTONOMOUS: medium trade (2%) with high confidence → EXECUTE", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.8 }),
      positionSizeQuote: 200, // 2%
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules,
    });
    expect(result.action).toBe("EXECUTE");
  });

  it("AUTONOMOUS: medium trade (2%) with low confidence → HOLD_FOR_CONFIRMATION", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.5 }),
      positionSizeQuote: 200, // 2%
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules,
    });
    // 2% at 0.5 confidence matches the REQUIRE_CONFIRMATION rule (0.03/0.0)
    expect(result.action).toBe("HOLD_FOR_CONFIRMATION");
  });

  it("AUTONOMOUS: large trade (4%) → REQUIRE_MANUAL", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.9 }),
      positionSizeQuote: 400, // 4%
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules,
    });
    expect(result.action).toBe("REQUIRE_MANUAL");
  });

  it("ASSISTED mode: even small trade → HOLD_FOR_CONFIRMATION", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.9 }),
      positionSizeQuote: 50, // 0.5%
      portfolioValue,
      operatingMode: "ASSISTED",
      rules,
    });
    expect(result.action).toBe("HOLD_FOR_CONFIRMATION");
  });

  it("AUTONOMOUS: very large trade (>5%) → REQUIRE_MANUAL", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.95 }),
      positionSizeQuote: 600, // 6%
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules,
    });
    expect(result.action).toBe("REQUIRE_MANUAL");
  });

  it("BLOCK rule in the rules list blocks the trade", () => {
    const customRules = [
      { maxCapitalFraction: 0.01, minConfidence: 0.0, action: "BLOCK" as const },
    ];
    const result = evaluateAutoApproval({
      proposal: makeProposal(),
      positionSizeQuote: 50,
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules: customRules,
    });
    expect(result.action).toBe("BLOCK");
  });

  it("capitalFraction is calculated correctly", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal(),
      positionSizeQuote: 100,
      portfolioValue: 10000,
      operatingMode: "AUTONOMOUS",
      rules,
    });
    expect(result.action).toBe("EXECUTE");
    if (result.action === "EXECUTE") {
      expect(result.capitalFraction).toBe(0.01);
    }
  });

  it("REQUIRE_CONFIRMATION rule triggers correctly", () => {
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.4 }),
      positionSizeQuote: 200, // 2% — matches 0.03 fraction, 0.0 minConf → REQUIRE_CONFIRMATION
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules,
    });
    expect(result.action).toBe("HOLD_FOR_CONFIRMATION");
  });

  it("no matching rule → REQUIRE_MANUAL", () => {
    const customRules = [
      { maxCapitalFraction: 0.001, minConfidence: 0.99, action: "AUTO" as const },
    ];
    const result = evaluateAutoApproval({
      proposal: makeProposal({ confidence: 0.5 }),
      positionSizeQuote: 200,
      portfolioValue,
      operatingMode: "AUTONOMOUS",
      rules: customRules,
    });
    expect(result.action).toBe("REQUIRE_MANUAL");
  });
});
