import { describe, it, expect } from "vitest";
import { evaluateDecisionGate } from "../src/decision-gate.js";
import type { DecisionGateReport, DecisionGateConfig } from "../src/decision-gate.js";
import type { TradeProposal } from "../src/types.js";

const defaultConfig: DecisionGateConfig = {
  minValidReports: 3,
  minConfidence: 0.5,
  maxProposalAgeMs: 3600_000,
  maxReportAgeMs: 7200_000,
};

const now = new Date("2026-07-28T12:00:00Z");

function makeValidReports(count: number, overrides: Partial<DecisionGateReport> = {}): DecisionGateReport[] {
  return Array.from({ length: count }, (_, i) => ({
    status: "VALID",
    runId: `run-${i}`,
    agentId: `agent-${i}`,
    signal: "BUY",
    score: 0.6,
    confidence: 0.7,
    dataQuality: 0.8,
    reasoning: [`Agent ${i} reasoning`],
    generatedAt: new Date(now.getTime() - 300_000).toISOString(),
    ...overrides,
  }));
}

function makeProposal(overrides: Partial<TradeProposal> = {}): TradeProposal {
  return {
    status: "VALID",
    asset: "BTCUSDT",
    action: "BUY",
    confidence: 0.7,
    rationale: ["Multiple agents bullish"],
    reportIds: ["run-0", "run-1", "run-2"],
    suggestedRiskFraction: 0.02,
    invalidationConditions: ["BTC drops below $60K"],
    expiresAt: new Date(now.getTime() + 1800_000).toISOString(),
    ...overrides,
  };
}

describe("Decision Gate — APPROVE", () => {
  it("approves a valid proposal with enough reports", () => {
    const reports = makeValidReports(4);
    const proposal = makeProposal();
    const result = evaluateDecisionGate(proposal, reports, defaultConfig, now);
    expect(result.decision).toBe("APPROVE");
    if (result.decision === "APPROVE") {
      expect(result.proposal.action).toBe("BUY");
    }
  });
});

describe("Decision Gate — BLOCK", () => {
  it("blocks UNAVAILABLE proposals", () => {
    const result = evaluateDecisionGate(
      makeProposal({ status: "UNAVAILABLE" }),
      makeValidReports(3),
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("BLOCK");
    if (result.decision === "BLOCK") {
      expect(result.ruleCode).toBe("UNAVAILABLE_PROPOSAL");
    }
  });

  it("blocks INVALID proposals", () => {
    const result = evaluateDecisionGate(
      makeProposal({ status: "INVALID" }),
      makeValidReports(3),
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("BLOCK");
    if (result.decision === "BLOCK") {
      expect(result.ruleCode).toBe("INVALID_PROPOSAL");
    }
  });

  it("blocks NO_ACTION proposals", () => {
    const result = evaluateDecisionGate(
      makeProposal({ status: "NO_ACTION" }),
      makeValidReports(3),
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("BLOCK");
    if (result.decision === "BLOCK") {
      expect(result.ruleCode).toBe("NO_ACTION_PROPOSAL");
    }
  });

  it("blocks expired proposals", () => {
    const result = evaluateDecisionGate(
      makeProposal({ expiresAt: new Date(now.getTime() - 1000).toISOString() }),
      makeValidReports(3),
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("BLOCK");
    if (result.decision === "BLOCK") {
      expect(result.ruleCode).toBe("DATA_TOO_STALE");
    }
  });

  it("blocks when not enough valid reports", () => {
    const result = evaluateDecisionGate(
      makeProposal(),
      makeValidReports(2),
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("BLOCK");
  });

  it("blocks when reports are too old", () => {
    const oldReports = makeValidReports(3, {
      generatedAt: new Date(now.getTime() - 3 * 3600_000).toISOString(),
    });
    const result = evaluateDecisionGate(
      makeProposal(),
      oldReports,
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("BLOCK");
    if (result.decision === "BLOCK") {
      expect(result.ruleCode).toBe("DATA_TOO_STALE");
    }
  });

  it("blocks low confidence proposals", () => {
    const result = evaluateDecisionGate(
      makeProposal({ confidence: 0.3 }),
      makeValidReports(3),
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("BLOCK");
    if (result.decision === "BLOCK") {
      expect(result.ruleCode).toBe("CONFIDENCE_TOO_LOW");
    }
  });
});

describe("Decision Gate — MANUAL_REVIEW", () => {
  it("flags AMBIGUOUS proposals for manual review", () => {
    const result = evaluateDecisionGate(
      makeProposal({ status: "AMBIGUOUS", action: null, suggestedRiskFraction: null }),
      makeValidReports(3),
      defaultConfig,
      now,
    );
    expect(result.decision).toBe("MANUAL_REVIEW");
  });

  it("detects conflicting BUY/SELL signals", () => {
    const reports: DecisionGateReport[] = [
      { status: "VALID", runId: "r1", agentId: "a1", signal: "BUY", score: 0.8, confidence: 0.9, dataQuality: 0.8, reasoning: ["bullish"], generatedAt: now.toISOString() },
      { status: "VALID", runId: "r2", agentId: "a2", signal: "SELL", score: -0.7, confidence: 0.85, dataQuality: 0.8, reasoning: ["bearish"], generatedAt: now.toISOString() },
      { status: "VALID", runId: "r3", agentId: "a3", signal: "HOLD", score: 0.1, confidence: 0.5, dataQuality: 0.7, reasoning: ["neutral"], generatedAt: now.toISOString() },
    ];
    const result = evaluateDecisionGate(makeProposal(), reports, defaultConfig, now);
    expect(result.decision).toBe("MANUAL_REVIEW");
  });
});

