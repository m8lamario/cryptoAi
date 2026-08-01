import type { Job } from "bullmq";
import { prisma } from "@cryptoai/database";
import { findPendingCheckpoints, addMemoryOutcome, finalizeDecisionMemory } from "@cryptoai/database";
import type { MemoryCheckpoint } from "@cryptoai/database";
import { logger } from "../logger.js";

export interface MemoryTrackerJobData {
  /** Which checkpoint to evaluate (default: all overdue) */
  checkpoint?: MemoryCheckpoint;
}

export interface MemoryTrackerJobResult {
  status: "completed" | "failed";
  checkpointsProcessed: number;
  outcomesAdded: number;
  finalized: number;
  error?: string;
}

const CHECKPOINT_TIMINGS: Record<string, number> = {
  AT_OPEN: 0,
  AFTER_1H: 60 * 60 * 1000,
  AFTER_6H: 6 * 60 * 60 * 1000,
  AFTER_24H: 24 * 60 * 60 * 1000,
  AFTER_7D: 7 * 24 * 60 * 60 * 1000,
  AFTER_30D: 30 * 24 * 60 * 60 * 1000,
};

const CHECKPOINTS_ORDERED: MemoryCheckpoint[] = [
  "AT_OPEN",
  "AFTER_1H",
  "AFTER_6H",
  "AFTER_24H",
  "AFTER_7D",
  "AFTER_30D",
];

/**
 * Memory Tracker Job — runs periodically (e.g., every 15 minutes).
 *
 * For each decision that has passed a checkpoint threshold:
 * 1. Get the current price for the asset
 * 2. Calculate P&L at this checkpoint
 * 3. Record the outcome
 * 4. If all checkpoints are done (AFTER_30D recorded), finalize
 */
export async function runMemoryTracker(
  job: Job<MemoryTrackerJobData, MemoryTrackerJobResult>,
): Promise<MemoryTrackerJobResult> {
  void job;
  let outcomesAdded = 0;
  let finalized = 0;

  try {
    const targetCheckpoints = job.data.checkpoint
      ? [job.data.checkpoint]
      : CHECKPOINTS_ORDERED;

    for (const checkpoint of targetCheckpoints) {
      const timingMs = CHECKPOINT_TIMINGS[checkpoint];
      if (timingMs === undefined) continue;

      const pending = await findPendingCheckpoints(checkpoint, timingMs);

      for (const entry of pending) {
        try {
          // Get current price for the asset
          const snapshot = await prisma.marketSnapshot.findFirst({
            where: { asset: { symbol: entry.asset } },
            orderBy: { collectedAt: "desc" },
          });

          if (!snapshot) {
            logger.warn({ asset: entry.asset }, "No price data for memory checkpoint");
            continue;
          }

          const currentPrice = Number(snapshot.price);
          const entryPrice = entry.entryPrice;
          const profitLossPercent = entryPrice > 0
            ? ((currentPrice - entryPrice) / entryPrice) * 100
            : 0;

          // Determine if the decision was correct
          // BUY: correct if price went up, SELL: correct if price went down
          const wasCorrect = entry.action === "BUY"
            ? currentPrice > entryPrice
            : currentPrice < entryPrice;

          await addMemoryOutcome(entry.proposalRunId, {
            checkpoint,
            profitLossPercent,
            wasCorrect,
            priceAtCheckpoint: currentPrice,
            recordedAt: new Date(),
          });

          outcomesAdded++;

          // Check if this was the last checkpoint
          if (checkpoint === "AFTER_30D") {
            await finalizeDecisionMemory(entry.proposalRunId, profitLossPercent);
            finalized++;
            logger.info(
              { proposalRunId: entry.proposalRunId, asset: entry.asset, finalResult: profitLossPercent.toFixed(2) + "%" },
              "Decision memory finalized",
            );
          }
        } catch (err) {
          logger.warn({ err, proposalRunId: entry.proposalRunId }, "Failed to record memory outcome");
        }
      }

      if (pending.length > 0) {
        logger.info(
          { checkpoint, pending: pending.length, outcomesAdded },
          "Memory tracker checkpoint processed",
        );
      }
    }

    return {
      status: "completed",
      checkpointsProcessed: targetCheckpoints.length,
      outcomesAdded,
      finalized,
    };
  } catch (err) {
    logger.error({ err }, "Memory tracker failed");
    return {
      status: "failed",
      checkpointsProcessed: 0,
      outcomesAdded,
      finalized,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
