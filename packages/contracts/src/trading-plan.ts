import { z } from "zod";

// --- TradingPlan — matches ProjectPlan v1.4 Section 2 ---

export const StrategySchema = z.enum(["SCALPING", "INTRADAY", "SWING", "POSITION"]);
export type Strategy = z.infer<typeof StrategySchema>;

export const UrgencySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type Urgency = z.infer<typeof UrgencySchema>;

export const TradingPlanSchema = z.object({
  strategy: StrategySchema,
  expectedDuration: z.string(),
  expectedProfitPercent: z.number(),
  expectedRiskPercent: z.number(),
  confidence: z.number().min(0).max(1),
  suggestedEntry: z.number().positive(),
  suggestedTakeProfit: z.number().positive(),
  suggestedStopLoss: z.number().positive(),
  urgency: UrgencySchema,
  reasons: z.array(z.string()).min(1),
});

export type TradingPlan = z.infer<typeof TradingPlanSchema>;

/** API response shape for a TradingPlan */
export interface TradingPlanResponse {
  strategy: "SCALPING" | "INTRADAY" | "SWING" | "POSITION";
  expectedDuration: string;
  expectedProfitPercent: number;
  expectedRiskPercent: number;
  confidence: number;
  suggestedEntry: number;
  suggestedTakeProfit: number;
  suggestedStopLoss: number;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

