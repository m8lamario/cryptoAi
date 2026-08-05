import { describe, expect, it } from "vitest";
import { evaluateDecisionGate } from "../src/decision-gate.js";
import { TradeProposalSchema, type TradeProposal } from "../src/types.js";

const plan = {
  strategy: "SWING" as const,
  expectedDuration: "3 days",
  expectedProfitPercent: 5,
  expectedRiskPercent: 2,
  confidence: 0.8,
  suggestedEntry: 100,
  suggestedTakeProfit: 110,
  suggestedStopLoss: 95,
  urgency: "MEDIUM" as const,
  reasons: ["trend"],
};
const proposal: TradeProposal = {
  status: "VALID", asset: "BTCUSDT", action: "BUY", confidence: 0.8,
  rationale: ["aligned"], reportIds: ["r1", "r2", "r3"], suggestedRiskFraction: null,
  invalidationConditions: ["trend breaks"], expiresAt: "2026-08-05T13:00:00.000Z",
  tradingPlan: plan, createdAt: "2026-08-05T12:00:00.000Z",
};
const reports = ["a", "b", "c"].map((id) => ({ status: "VALID", runId: id, agentId: id, signal: "BUY", score: 0.7, confidence: 0.8, dataQuality: 1, reasoning: ["x"], generatedAt: "2026-08-05T12:30:00.000Z" }));

describe("M6 unified proposal contract", () => {
  it("requires a TradingPlan for actionable proposals at the gate", () => {
    expect(TradeProposalSchema.safeParse({ ...proposal, tradingPlan: null }).success).toBe(true);
    expect(evaluateDecisionGate({ ...proposal, tradingPlan: null }, reports, { minValidReports: 3, minConfidence: 0.5, maxProposalAgeMs: 3600000, maxReportAgeMs: 7200000 }, new Date("2026-08-05T12:45:00.000Z"))).toMatchObject({ decision: "BLOCK", ruleCode: "INVALID_PROPOSAL" });
  });
  it("blocks two valid reports when quorum is three", () => {
    expect(evaluateDecisionGate(proposal, reports.slice(0, 2), { minValidReports: 3, minConfidence: 0.5, maxProposalAgeMs: 3600000, maxReportAgeMs: 7200000 }, new Date("2026-08-05T12:45:00.000Z"))).toMatchObject({ decision: "BLOCK", ruleCode: "UNAVAILABLE_PROPOSAL" });
  });
  it("blocks an over-age proposal", () => {
    expect(evaluateDecisionGate(proposal, reports, { minValidReports: 3, minConfidence: 0.5, maxProposalAgeMs: 60000, maxReportAgeMs: 7200000 }, new Date("2026-08-05T12:02:00.000Z"))).toMatchObject({ decision: "BLOCK", ruleCode: "DATA_TOO_STALE" });
  });
});

