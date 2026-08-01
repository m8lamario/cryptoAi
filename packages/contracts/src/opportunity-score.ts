import { z } from "zod";

// --- MarketOpportunityScore — matches ProjectPlan v1.4 Section 4 ---

export const OpportunityClassificationSchema = z.enum([
  "IGNORE",
  "MONITORING",
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
  AI_ANALYSIS_MAX: 80,
  // 80+ = MAX_PRIORITY
} as const;

/** Classify a score (0-100) into the opportunity bracket */
export function classifyOpportunity(score: number): OpportunityClassification {
  if (score <= OPPORTUNITY_THRESHOLDS.IGNORE_MAX) return "IGNORE";
  if (score <= OPPORTUNITY_THRESHOLDS.MONITORING_MAX) return "MONITORING";
  if (score <= OPPORTUNITY_THRESHOLDS.AI_ANALYSIS_MAX) return "AI_ANALYSIS";
  return "MAX_PRIORITY";
}

/** API response shape for a MarketOpportunityScore */
export interface MarketOpportunityScoreResponse {
  asset: string;
  score: number;
  classification: OpportunityClassification;
  components: { name: string; value: number; weight: number }[];
  evaluatedAt: string;
}

