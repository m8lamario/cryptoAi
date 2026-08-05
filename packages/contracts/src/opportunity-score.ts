import { z } from "zod";

// --- MarketOpportunityScore — matches ProjectPlan v1.4 Section 4 ---

export const OpportunityClassificationSchema = z.enum([
  "IGNORE",
  "MONITORING",
  "QUANTITATIVE_ANALYSIS",
  "AI_ANALYSIS",
  "MAX_PRIORITY",
]);
export type OpportunityClassification = z.infer<typeof OpportunityClassificationSchema>;

/** Individual component of the opportunity score */
export const OpportunityComponentSchema = z.object({
  name: z.string(),
  value: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
});

export const MarketOpportunityScoreSchema = z.object({
  asset: z.string(),
  score: z.number().min(0).max(100),
  classification: OpportunityClassificationSchema,
  components: z.array(OpportunityComponentSchema),
  evaluatedAt: z.string().datetime(),
});

export type MarketOpportunityScore = z.infer<typeof MarketOpportunityScoreSchema>;

/** Thresholds for opportunity score classification */
export const OPPORTUNITY_THRESHOLDS = {
  IGNORE_MAX: 30,
  MONITORING_MAX: 60,
  QUANTITATIVE_MAX: 80,
  // 80+ = AI_ANALYSIS / MAX_PRIORITY
} as const;

/** Classify a score (0-100) into the opportunity bracket */
export function classifyOpportunity(score: number): OpportunityClassification {
  if (score <= OPPORTUNITY_THRESHOLDS.IGNORE_MAX) return "IGNORE";
  if (score <= OPPORTUNITY_THRESHOLDS.MONITORING_MAX) return "MONITORING";
  if (score <= OPPORTUNITY_THRESHOLDS.QUANTITATIVE_MAX) return "QUANTITATIVE_ANALYSIS";
  return "AI_ANALYSIS";
}

/** API response shape for a MarketOpportunityScore */
export interface MarketOpportunityScoreResponse {
  asset: string;
  score: number;
  classification: OpportunityClassification;
  components: { name: string; value: number; weight: number }[];
  evaluatedAt: string;
}

export const DirectionalQuantitativeScoreSchema = z.object({
  asset: z.string(),
  score: z.number().min(0).max(100),
  classification: OpportunityClassificationSchema,
  components: z.array(OpportunityComponentSchema),
  direction: z.enum(["LONG", "SHORT", "FLAT"]),
  opportunityIntensity: z.number().min(0).max(100),
  directionScore: z.number().min(-100).max(100),
  expectedMove: z.number(),
  expectedRisk: z.number().nonnegative(),
  estimatedCosts: z.object({
    spread: z.number().nonnegative(),
    slippage: z.number().nonnegative(),
    fees: z.number().nonnegative(),
    turnover: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
  netEdge: z.number(),
  horizonCandles: z.number().int().positive(),
  formulaVersion: z.string().min(1),
  featureVersion: z.string().min(1),
  features: z.record(z.number().nullable()),
  evaluatedAt: z.string().datetime(),
});
export type DirectionalQuantitativeScore = z.infer<typeof DirectionalQuantitativeScoreSchema>;
