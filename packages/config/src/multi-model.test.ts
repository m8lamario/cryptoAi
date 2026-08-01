import { describe, it, expect } from "vitest";
import {
  MultiModelConfigSchema,
  DEFAULT_MULTI_MODEL_CONFIG,
  getRoleConfig,
  validateModelDiversity,
} from "../src/multi-model.js";

describe("MultiModelConfigSchema", () => {
  it("accepts default config", () => {
    const result = MultiModelConfigSchema.safeParse(DEFAULT_MULTI_MODEL_CONFIG);
    expect(result.success).toBe(true);
  });

  it("accepts SINGLE consensus mode", () => {
    const result = MultiModelConfigSchema.safeParse({ ...DEFAULT_MULTI_MODEL_CONFIG, consensusMode: "SINGLE" });
    expect(result.success).toBe(true);
  });

  it("accepts SECOND_OPINION consensus mode", () => {
    const result = MultiModelConfigSchema.safeParse({ ...DEFAULT_MULTI_MODEL_CONFIG, consensusMode: "SECOND_OPINION" });
    expect(result.success).toBe(true);
  });

  it("accepts CONSENSUS mode", () => {
    const result = MultiModelConfigSchema.safeParse({ ...DEFAULT_MULTI_MODEL_CONFIG, consensusMode: "CONSENSUS" });
    expect(result.success).toBe(true);
  });

  it("rejects negative global budget", () => {
    const result = MultiModelConfigSchema.safeParse({
      ...DEFAULT_MULTI_MODEL_CONFIG,
      globalDailyBudgetUsd: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("getRoleConfig", () => {
  it("finds technical agent config", () => {
    const cfg = getRoleConfig(DEFAULT_MULTI_MODEL_CONFIG, "technical");
    expect(cfg).toBeDefined();
    expect(cfg!.role).toBe("technical");
  });

  it("finds manager config", () => {
    const cfg = getRoleConfig(DEFAULT_MULTI_MODEL_CONFIG, "manager");
    expect(cfg).toBeDefined();
    expect(cfg!.family).toBe("openai");
  });

  it("returns undefined for unknown role", () => {
    const cfg = getRoleConfig(DEFAULT_MULTI_MODEL_CONFIG, "unknown" as any);
    expect(cfg).toBeUndefined();
  });
});

describe("validateModelDiversity", () => {
  it("passes when manager uses different family than analysts", () => {
    const issues = validateModelDiversity(DEFAULT_MULTI_MODEL_CONFIG);
    // Manager is openai, analysts are deepseek — should pass
    expect(issues).toHaveLength(0);
  });

  it("fails when manager uses same family as dominant", () => {
    const config = {
      ...DEFAULT_MULTI_MODEL_CONFIG,
      roles: DEFAULT_MULTI_MODEL_CONFIG.roles.map((r) =>
        r.role === "manager" ? { ...r, family: "deepseek" as const, provider: "openrouter" } : r,
      ),
    };
    const issues = validateModelDiversity(config);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain("same model family");
  });

  it("fails when no manager configured", () => {
    const config = {
      ...DEFAULT_MULTI_MODEL_CONFIG,
      roles: [],
    };
    const issues = validateModelDiversity(config);
    expect(issues).toContain("No manager model configured");
  });
});

describe("DEFAULT_MULTI_MODEL_CONFIG", () => {
  it("has exactly 7 roles configured", () => {
    expect(DEFAULT_MULTI_MODEL_CONFIG.roles).toHaveLength(7);
  });

  it("has all required roles", () => {
    const roleNames = DEFAULT_MULTI_MODEL_CONFIG.roles.map((r) => r.role);
    expect(roleNames).toContain("technical");
    expect(roleNames).toContain("macro");
    expect(roleNames).toContain("news");
    expect(roleNames).toContain("sentiment");
    expect(roleNames).toContain("whale");
    expect(roleNames).toContain("manager");
    expect(roleNames).toContain("second_opinion");
  });

  it("has no duplicate roles", () => {
    const roleNames = DEFAULT_MULTI_MODEL_CONFIG.roles.map((r) => r.role);
    expect(new Set(roleNames).size).toBe(roleNames.length);
  });

  it("has global budget > sum of individual budgets", () => {
    const sumIndividual = DEFAULT_MULTI_MODEL_CONFIG.roles.reduce((s, r) => s + r.dailyBudgetUsd, 0);
    expect(DEFAULT_MULTI_MODEL_CONFIG.globalDailyBudgetUsd).toBeGreaterThanOrEqual(sumIndividual);
  });
});
