import { z } from "zod";

// --- Multi-Model Configuration — matches ProjectPlan v1.4 Section 6 ---

/** Supported model families via OpenRouter */
export const ModelFamilySchema = z.enum(["deepseek", "openai", "anthropic", "google"]);
export type ModelFamily = z.infer<typeof ModelFamilySchema>;

/** Consensus mode for multi-model operation */
export const ConsensusModeSchema = z.enum(["SINGLE", "SECOND_OPINION", "CONSENSUS"]);
export type ConsensusMode = z.infer<typeof ConsensusModeSchema>;

/** Per-role model configuration */
export const RoleModelConfigSchema = z.object({
  role: z.enum([
    "technical",
    "macro",
    "news",
    "sentiment",
    "whale",
    "manager",
    "second_opinion",
  ]),
  provider: z.string().default("openrouter"),
  modelId: z.string(),
  family: ModelFamilySchema,
  maxTokens: z.number().int().positive().default(1500),
  reasoning: z.enum(["low", "medium", "high", "xhigh"]).default("high"),
  temperature: z.number().min(0).max(2).default(0.3),
  /** Budget cap for this specific role (USD/day) */
  dailyBudgetUsd: z.number().min(0).default(0.5),
});

export type RoleModelConfig = z.infer<typeof RoleModelConfigSchema>;

/** Full multi-model configuration */
export const MultiModelConfigSchema = z.object({
  consensusMode: ConsensusModeSchema.default("SINGLE"),
  roles: z.array(RoleModelConfigSchema),
  /** Global daily budget across all models (USD) */
  globalDailyBudgetUsd: z.number().min(0).default(5),
  /** Global monthly budget across all models (USD) */
  globalMonthlyBudgetUsd: z.number().min(0).default(100),
});

export type MultiModelConfig = z.infer<typeof MultiModelConfigSchema>;

/** Default model configuration with DeepSeek as the primary provider */
export const DEFAULT_MULTI_MODEL_CONFIG: MultiModelConfig = {
  consensusMode: "SINGLE",
  roles: [
    {
      role: "technical",
      provider: "openrouter",
      modelId: "deepseek/deepseek-chat",
      family: "deepseek",
      maxTokens: 1500,
      reasoning: "high",
      temperature: 0.3,
      dailyBudgetUsd: 0.3,
    },
    {
      role: "macro",
      provider: "openrouter",
      modelId: "deepseek/deepseek-chat",
      family: "deepseek",
      maxTokens: 1500,
      reasoning: "high",
      temperature: 0.3,
      dailyBudgetUsd: 0.3,
    },
    {
      role: "news",
      provider: "openrouter",
      modelId: "deepseek/deepseek-chat",
      family: "deepseek",
      maxTokens: 1500,
      reasoning: "high",
      temperature: 0.3,
      dailyBudgetUsd: 0.3,
    },
    {
      role: "sentiment",
      provider: "openrouter",
      modelId: "deepseek/deepseek-chat",
      family: "deepseek",
      maxTokens: 1500,
      reasoning: "high",
      temperature: 0.3,
      dailyBudgetUsd: 0.3,
    },
    {
      role: "whale",
      provider: "openrouter",
      modelId: "deepseek/deepseek-chat",
      family: "deepseek",
      maxTokens: 1500,
      reasoning: "high",
      temperature: 0.3,
      dailyBudgetUsd: 0.3,
    },
    {
      role: "manager",
      provider: "openrouter",
      modelId: "openai/gpt-4o-mini",
      family: "openai",
      maxTokens: 2000,
      reasoning: "high",
      temperature: 0.2,
      dailyBudgetUsd: 0.5,
    },
    {
      role: "second_opinion",
      provider: "openrouter",
      modelId: "anthropic/claude-3-haiku",
      family: "anthropic",
      maxTokens: 2000,
      reasoning: "xhigh",
      temperature: 0.1,
      dailyBudgetUsd: 0.3,
    },
  ],
  globalDailyBudgetUsd: 5,
  globalMonthlyBudgetUsd: 100,
};

/** Look up the model config for a given role */
export function getRoleConfig(config: MultiModelConfig, role: RoleModelConfig["role"]): RoleModelConfig | undefined {
  return config.roles.find((r) => r.role === role);
}

/** Check if the manager uses a different model family than the analysts (as required by Project Plan) */
export function validateModelDiversity(config: MultiModelConfig): string[] {
  const issues: string[] = [];
  const analysts = config.roles.filter((r) => r.role !== "manager" && r.role !== "second_opinion");
  const manager = config.roles.find((r) => r.role === "manager");

  if (!manager) {
    issues.push("No manager model configured");
    return issues;
  }

  const dominantFamily = getDominantFamily(analysts);
  if (dominantFamily && manager.family === dominantFamily) {
    issues.push(
      `Investment Manager uses the same model family (${manager.family}) ` +
      `as the dominant analyst family (${dominantFamily}). ` +
      `This violates the diversity principle in ProjectPlan Section 2.2.`,
    );
  }

  return issues;
}

function getDominantFamily(roles: RoleModelConfig[]): ModelFamily | null {
  if (roles.length === 0) return null;
  const counts = new Map<ModelFamily, number>();
  for (const r of roles) {
    counts.set(r.family, (counts.get(r.family) ?? 0) + 1);
  }
  let maxCount = 0;
  let dominant: ModelFamily | null = null;
  for (const [family, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = family;
    }
  }
  return dominant;
}
