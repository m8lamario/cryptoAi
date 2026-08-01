import { describe, it, expect } from "vitest";
import {
  OperatingModeSchema,
  AutoApprovalRuleSchema,
  DEFAULT_AUTO_APPROVAL_RULES,
} from "../src/operating-mode.js";
import type { AutoApprovalRule } from "../src/operating-mode.js";

describe("OperatingMode", () => {
  it("accepts PAPER", () => {
    expect(OperatingModeSchema.safeParse("PAPER").success).toBe(true);
  });

  it("accepts ASSISTED", () => {
    expect(OperatingModeSchema.safeParse("ASSISTED").success).toBe(true);
  });

  it("accepts AUTONOMOUS", () => {
    expect(OperatingModeSchema.safeParse("AUTONOMOUS").success).toBe(true);
  });

  it("rejects invalid mode", () => {
    expect(OperatingModeSchema.safeParse("REAL").success).toBe(false);
  });
});

describe("AutoApprovalRule", () => {
  const validRule: AutoApprovalRule = {
    maxCapitalFraction: 0.03,
    minConfidence: 0.7,
    action: "AUTO",
  };

  it("accepts a valid rule", () => {
    expect(AutoApprovalRuleSchema.safeParse(validRule).success).toBe(true);
  });

  it("rejects negative fraction", () => {
    expect(AutoApprovalRuleSchema.safeParse({ ...validRule, maxCapitalFraction: -0.1 }).success).toBe(false);
  });

  it("rejects fraction > 1", () => {
    expect(AutoApprovalRuleSchema.safeParse({ ...validRule, maxCapitalFraction: 1.5 }).success).toBe(false);
  });

  it("accepts all action types", () => {
    for (const action of ["AUTO", "REQUIRE_CONFIRMATION", "ALWAYS_MANUAL"] as const) {
      expect(AutoApprovalRuleSchema.safeParse({ ...validRule, action }).success).toBe(true);
    }
  });
});

describe("DEFAULT_AUTO_APPROVAL_RULES", () => {
  it("has 4 rules", () => {
    expect(DEFAULT_AUTO_APPROVAL_RULES).toHaveLength(4);
  });

  it("is sorted by increasing maxCapitalFraction", () => {
    const fractions = DEFAULT_AUTO_APPROVAL_RULES.map((r) => r.maxCapitalFraction);
    const sorted = [...fractions].sort((a, b) => a - b);
    expect(fractions).toEqual(sorted);
  });

  it("highest tier is always manual", () => {
    const lastRule = DEFAULT_AUTO_APPROVAL_RULES[DEFAULT_AUTO_APPROVAL_RULES.length - 1]!;
    expect(lastRule.action).toBe("ALWAYS_MANUAL");
  });
});
