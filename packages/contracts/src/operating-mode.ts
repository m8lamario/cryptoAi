import { z } from "zod";

// --- OperatingMode — matches ProjectPlan v1.4 Section 9 ---

export const OperatingModeSchema = z.enum(["PAPER", "ASSISTED", "AUTONOMOUS"]);
export type OperatingMode = z.infer<typeof OperatingModeSchema>;

/** Auto-approval rules — matches ProjectPlan v1.4 Section 7 */
export const AutoApprovalRuleSchema = z.object({
  /** Max position size as fraction of portfolio (e.g., 0.01 = 1%) */
  maxCapitalFraction: z.number().min(0).max(1),
  /** Minimum confidence required for this tier */
  minConfidence: z.number().min(0).max(1),
  /** Action to take when this rule matches */
  action: z.enum(["AUTO", "REQUIRE_CONFIRMATION", "ALWAYS_MANUAL"]),
});

export type AutoApprovalRule = z.infer<typeof AutoApprovalRuleSchema>;

export const DEFAULT_AUTO_APPROVAL_RULES: AutoApprovalRule[] = [
  { maxCapitalFraction: 0.01, minConfidence: 0.0, action: "AUTO" },
  { maxCapitalFraction: 0.03, minConfidence: 0.7, action: "AUTO" },
  { maxCapitalFraction: 0.03, minConfidence: 0.0, action: "REQUIRE_CONFIRMATION" },
  { maxCapitalFraction: 0.05, minConfidence: 0.0, action: "ALWAYS_MANUAL" },
];

export interface OperatingModeConfigResponse {
  mode: OperatingMode;
  autoApprovalRules: AutoApprovalRule[];
  updatedAt: string;
}

