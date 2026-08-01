import type { TradeProposal } from "./types.js";

/**
 * Auto-approval rules — matches ProjectPlan v1.4 Section 7.
 *
 * Tiered rules:
 * - <1% capitale → AUTO
 * - 1-3% capitale → AUTO solo con confidence elevata
 * - >3% capitale → Richiede approvazione
 * - >5% capitale → Sempre approvazione manuale
 */

export interface AutoApprovalRule {
  /** Max position size as fraction of portfolio (e.g., 0.01 = 1%) */
  maxCapitalFraction: number;
  /** Minimum confidence required for this tier */
  minConfidence: number;
  /** Action to take when this rule matches */
  action: "AUTO" | "REQUIRE_CONFIRMATION" | "ALWAYS_MANUAL" | "BLOCK";
}

export const DEFAULT_AUTO_APPROVAL_RULES: AutoApprovalRule[] = [
  { maxCapitalFraction: 0.01, minConfidence: 0.0, action: "AUTO" },
  { maxCapitalFraction: 0.03, minConfidence: 0.7, action: "AUTO" },
  { maxCapitalFraction: 0.03, minConfidence: 0.0, action: "REQUIRE_CONFIRMATION" },
  { maxCapitalFraction: 0.05, minConfidence: 0.0, action: "ALWAYS_MANUAL" },
  // Anything >5% is always blocked at the risk manager level
];

/**
 * Current operating mode of the system.
 * PAPER: 100% virtual, no real orders.
 * ASSISTED: AI proposes, owner confirms before execution.
 * AUTONOMOUS: AI auto-executes within limits.
 */
export type OperatingMode = "PAPER" | "ASSISTED" | "AUTONOMOUS";

export interface AutoApprovalInput {
  /** The proposal to evaluate */
  proposal: TradeProposal;
  /** Position size in quote currency (USDT) */
  positionSizeQuote: number;
  /** Total portfolio value in quote currency */
  portfolioValue: number;
  /** Current operating mode */
  operatingMode: OperatingMode;
  /** Auto-approval rules (tiered) */
  rules: AutoApprovalRule[];
}

export type AutoApprovalResult =
  | {
      action: "EXECUTE";
      /** Rule that matched */
      matchedRule: AutoApprovalRule;
      /** Fraction of portfolio this trade represents */
      capitalFraction: number;
    }
  | {
      action: "HOLD_FOR_CONFIRMATION";
      reason: string;
      matchedRule: AutoApprovalRule;
      capitalFraction: number;
    }
  | {
      action: "REQUIRE_MANUAL";
      reason: string;
      matchedRule: AutoApprovalRule;
      capitalFraction: number;
    }
  | {
      action: "BLOCK";
      reason: string;
    };

/**
 * Evaluate a trade proposal against auto-approval rules.
 *
 * This is a deterministic filter that applies the tiered approval rules
 * based on the position size, confidence, and current operating mode.
 */
export function evaluateAutoApproval(input: AutoApprovalInput): AutoApprovalResult {
  const { proposal, positionSizeQuote, portfolioValue, operatingMode, rules } = input;

  // PAPER mode: always auto-execute (it's fake money)
  if (operatingMode === "PAPER") {
    return {
      action: "EXECUTE",
      matchedRule: { maxCapitalFraction: 1.0, minConfidence: 0.0, action: "AUTO" },
      capitalFraction: portfolioValue > 0 ? positionSizeQuote / portfolioValue : 0,
    };
  }

  if (rules.length === 0) {
    return { action: "BLOCK", reason: "No auto-approval rules configured" };
  }

  const capitalFraction = portfolioValue > 0 ? positionSizeQuote / portfolioValue : 0;
  const confidence = proposal.confidence;

  // Find the first matching rule (rules are sorted by increasing fraction)
  for (const rule of rules) {
    if (capitalFraction <= rule.maxCapitalFraction && confidence >= rule.minConfidence) {
      switch (rule.action) {
        case "AUTO":
          // AUTONOMOUS: execute. ASSISTED: hold for confirmation.
          if (operatingMode === "AUTONOMOUS") {
            return { action: "EXECUTE", matchedRule: rule, capitalFraction };
          }
          return {
            action: "HOLD_FOR_CONFIRMATION",
            reason: `Auto-approved but ASSISTED mode requires confirmation (${(capitalFraction * 100).toFixed(1)}% of portfolio)`,
            matchedRule: rule,
            capitalFraction,
          };

        case "REQUIRE_CONFIRMATION":
          return {
            action: "HOLD_FOR_CONFIRMATION",
            reason: `Rule requires confirmation: ${(capitalFraction * 100).toFixed(1)}% of portfolio, confidence ${confidence.toFixed(2)}`,
            matchedRule: rule,
            capitalFraction,
          };

        case "ALWAYS_MANUAL":
          return {
            action: "REQUIRE_MANUAL",
            reason: `Rule requires manual approval: ${(capitalFraction * 100).toFixed(1)}% of portfolio exceeds auto-approval threshold`,
            matchedRule: rule,
            capitalFraction,
          };

        case "BLOCK":
          return {
            action: "BLOCK",
            reason: "Rule blocks this trade",
          };
      }
    }
  }

  // No rule matched — fallback: manual review
  return {
    action: "REQUIRE_MANUAL",
    reason: `No matching auto-approval rule for ${(capitalFraction * 100).toFixed(1)}% of portfolio, confidence ${confidence.toFixed(2)}`,
    matchedRule: { maxCapitalFraction: 1.0, minConfidence: 1.0, action: "ALWAYS_MANUAL" },
    capitalFraction,
  };
}

