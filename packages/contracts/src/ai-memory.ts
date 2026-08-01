import { z } from "zod";

// --- AI Decision Memory — matches ProjectPlan v1.4 Section 5 ---

export const MemoryCheckpointSchema = z.enum([
  "AT_OPEN",
  "AFTER_1H",
  "AFTER_6H",
  "AFTER_24H",
  "AFTER_7D",
  "AFTER_30D",
]);
export type MemoryCheckpoint = z.infer<typeof MemoryCheckpointSchema>;

/** Outcome recorded at a specific checkpoint after a decision */
export const MemoryOutcomeSchema = z.object({
  checkpoint: MemoryCheckpointSchema,
  profitLossPercent: z.number(),
  wasCorrect: z.boolean().nullable(),
  priceAtCheckpoint: z.number(),
  recordedAt: z.string().datetime(),
});

/** A single AI decision memory entry */
export const AIDecisionMemorySchema = z.object({
  id: z.string(),
  proposalRunId: z.string(),
  asset: z.string(),
  action: z.enum(["BUY", "SELL"]),
  strategy: z.enum(["SCALPING", "INTRADAY", "SWING", "POSITION"]).nullable(),
  entryPrice: z.number(),
  /** Context snapshot at decision time */
  indicatorsJson: z.record(z.unknown()),
  modelUsed: z.string(),
  promptVersion: z.string(),
  confidenceAtDecision: z.number().min(0).max(1),
  decidedAt: z.string().datetime(),
  outcomes: z.array(MemoryOutcomeSchema),
  finalResult: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AIDecisionMemory = z.infer<typeof AIDecisionMemorySchema>;
export type MemoryOutcome = z.infer<typeof MemoryOutcomeSchema>;

/** API response for AI decision memory */
export interface AIDecisionMemoryResponse {
  id: string;
  proposalRunId: string;
  asset: string;
  action: "BUY" | "SELL";
  strategy: "SCALPING" | "INTRADAY" | "SWING" | "POSITION" | null;
  entryPrice: number;
  modelUsed: string;
  promptVersion: string;
  confidenceAtDecision: number;
  decidedAt: string;
  outcomes: {
    checkpoint: MemoryCheckpoint;
    profitLossPercent: number;
    wasCorrect: boolean | null;
    priceAtCheckpoint: number;
    recordedAt: string;
  }[];
  finalResult: number | null;
}

/** Checkpoint timings in milliseconds from decision time */
export const CHECKPOINT_TIMINGS: Record<MemoryCheckpoint, number> = {
  AT_OPEN: 0,
  AFTER_1H: 60 * 60 * 1000,
  AFTER_6H: 6 * 60 * 60 * 1000,
  AFTER_24H: 24 * 60 * 60 * 1000,
  AFTER_7D: 7 * 24 * 60 * 60 * 1000,
  AFTER_30D: 30 * 24 * 60 * 60 * 1000,
};

