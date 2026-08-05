import type { TradeProposal } from "./types.js";

/** Minimal report interface for the Decision Gate (avoids circular dependency with @cryptoai/agents) */
export interface DecisionGateReport {
  status: string;
  runId: string;
  agentId: string;
  signal: string | null;
  score: number;
  confidence: number;
  dataQuality: number;
  reasoning: string[];
  generatedAt: string;
}

/**
 * Decision Gate result.
 * APPROVE: forward to Risk Manager
 * BLOCK: stop here (no further processing)
 * MANUAL_REVIEW: requires owner's manual decision (AMBIGUOUS proposals)
 */
export type DecisionGateResult =
  | { decision: "APPROVE"; proposal: TradeProposal; reports: DecisionGateReport[] }
  | { decision: "BLOCK"; reason: string; ruleCode: string }
  | { decision: "MANUAL_REVIEW"; reason: string; proposal: TradeProposal; reports: DecisionGateReport[] };

export interface DecisionGateConfig {
  /** Minimum number of VALID agent reports required */
  minValidReports: number;
  /** Minimum confidence for a proposal to proceed */
  minConfidence: number;
  /** Maximum age of a proposal before it expires (ms) */
  maxProposalAgeMs: number;
  /** Maximum age of agent reports before they're considered stale (ms) */
  maxReportAgeMs: number;
}

/**
 * Deterministic Decision Gate.
 *
 * Evaluates the Manager's TradeProposal and determines whether to:
 * - APPROVE: forward to the Risk Manager
 * - BLOCK: stop processing (e.g., not enough valid reports, expired)
 * - MANUAL_REVIEW: requires human decision (AMBIGUOUS proposals)
 *
 * The Decision Gate is a deterministic filter between the Manager AI and the Risk Manager.
 */
export function evaluateDecisionGate(
  proposal: TradeProposal,
  reports: DecisionGateReport[],
  config: DecisionGateConfig,
  now: Date = new Date(),
): DecisionGateResult {
  // 1. Check proposal status
  if (proposal.status === "UNAVAILABLE" || proposal.status === "INVALID") {
    return {
      decision: "BLOCK",
      reason: `Proposal status is ${proposal.status}`,
      ruleCode: proposal.status === "UNAVAILABLE" ? "UNAVAILABLE_PROPOSAL" : "INVALID_PROPOSAL",
    };
  }

  if (proposal.status === "AMBIGUOUS") {
    return {
      decision: "MANUAL_REVIEW",
      reason: "TradeProposal is AMBIGUOUS — manual review required",
      proposal,
      reports,
    };
  }

  if (proposal.status === "NO_ACTION") {
    return {
      decision: "BLOCK",
      reason: "No action recommended by Investment Manager",
      ruleCode: "NO_ACTION_PROPOSAL",
    };
  }

  if (proposal.status === "VALID" && (proposal.action === "BUY" || proposal.action === "SELL") && proposal.tradingPlan === null) {
    return { decision: "BLOCK", reason: "Actionable proposal is missing a complete TradingPlan", ruleCode: "INVALID_PROPOSAL" };
  }

  // 2. Check proposal expiry
  if (proposal.expiresAt) {
    const expiresAt = new Date(proposal.expiresAt);
    if (now >= expiresAt) {
      return {
        decision: "BLOCK",
        reason: `Proposal expired at ${proposal.expiresAt}`,
        ruleCode: "DATA_TOO_STALE",
      };
    }
  }

  if (proposal.createdAt) {
    const createdAt = new Date(proposal.createdAt);
    if (now.getTime() - createdAt.getTime() > config.maxProposalAgeMs) {
      return { decision: "BLOCK", reason: "TradeProposal is older than the configured maximum age", ruleCode: "DATA_TOO_STALE" };
    }
  }

  // 3. Check quorum — enough valid reports?
  const validReports = reports.filter((r) => r.status === "VALID");
  if (validReports.length < config.minValidReports) {
    return {
      decision: "BLOCK",
      reason: `Insufficient valid reports: ${validReports.length}/${reports.length} (minimum ${config.minValidReports})`,
      ruleCode: "UNAVAILABLE_PROPOSAL",
    };
  }

  // 4. Check report staleness
  const oldestReport = validReports.reduce((oldest, r) => {
    const t = new Date(r.generatedAt).getTime();
    return t < oldest ? t : oldest;
  }, Infinity);

  if (oldestReport !== Infinity) {
    const ageMs = now.getTime() - oldestReport;
    if (ageMs > config.maxReportAgeMs) {
      return {
        decision: "BLOCK",
        reason: `Agent reports are too old (${Math.round(ageMs / 1000)}s > ${Math.round(config.maxReportAgeMs / 1000)}s)`,
        ruleCode: "DATA_TOO_STALE",
      };
    }
  }

  // 5. Check confidence
  if (proposal.confidence < config.minConfidence) {
    return {
      decision: "BLOCK",
      reason: `Proposal confidence ${proposal.confidence.toFixed(2)} below minimum ${config.minConfidence}`,
      ruleCode: "CONFIDENCE_TOO_LOW",
    };
  }

  // 6. Detect ambiguity in reports independently
  const ambiguityResult = detectReportAmbiguity(validReports);
  if (ambiguityResult.isAmbiguous) {
    return {
      decision: "MANUAL_REVIEW",
      reason: ambiguityResult.reason,
      proposal,
      reports: validReports,
    };
  }

  // 7. All checks passed — forward to Risk Manager
  return {
    decision: "APPROVE",
    proposal,
    reports: validReports,
  };
}

function detectReportAmbiguity(reports: DecisionGateReport[]): { isAmbiguous: boolean; reason: string } {
  const withSignals = reports.filter(
    (r) => r.signal !== null && r.signal !== "HOLD" && r.signal !== "WAIT",
  );

  if (withSignals.length < 2) return { isAmbiguous: false, reason: "" };

  const hasBuy = withSignals.some((r) => r.signal === "BUY");
  const hasSell = withSignals.some((r) => r.signal === "SELL");

  if (hasBuy && hasSell) {
    const buyConf = withSignals.filter((r) => r.signal === "BUY").reduce((s, r) => s + r.confidence, 0);
    const sellConf = withSignals.filter((r) => r.signal === "SELL").reduce((s, r) => s + r.confidence, 0);
    const maxC = Math.max(buyConf, sellConf);
    const minC = Math.min(buyConf, sellConf);

    if (maxC > 0 && minC / maxC > 0.5) {
      return {
        isAmbiguous: true,
        reason: `Directly conflicting BUY/SELL signals (BUY confidence=${buyConf.toFixed(2)}, SELL confidence=${sellConf.toFixed(2)})`,
      };
    }
  }

  return { isAmbiguous: false, reason: "" };
}
