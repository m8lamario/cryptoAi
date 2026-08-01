import type { Job } from "bullmq";
import { prisma, saveEquitySnapshot } from "@cryptoai/database";
import { logger } from "../logger.js";

export interface EquitySnapshotJobData {
  timestamp?: string;
}

export interface EquitySnapshotJobResult {
  status: "completed" | "skipped" | "failed";
  equity: number | null;
  snapshotId?: string;
  error?: string;
}

export interface EquityPosition {
  quantity: number;
  currentPrice: number;
}

export function calculateEquity(cash: number, positions: EquityPosition[]): number {
  const positionValue = positions.reduce(
    (sum, position) => sum + position.quantity * position.currentPrice,
    0,
  );
  return Number((cash + positionValue).toFixed(2));
}

export async function captureEquitySnapshot(
  job: Job<EquitySnapshotJobData, EquitySnapshotJobResult>,
): Promise<EquitySnapshotJobResult> {
  try {
    const balance = await prisma.paperBalance.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!balance) {
      return { status: "skipped", equity: null };
    }

    const positions = await prisma.paperPosition.findMany({
      where: { status: "OPEN" },
      select: { quantity: true, currentPrice: true },
    });
    const equity = calculateEquity(
      Number(balance.quote),
      positions.map((position) => ({
        quantity: Number(position.quantity),
        currentPrice: Number(position.currentPrice),
      })),
    );
    const timestamp = job.data.timestamp ? new Date(job.data.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      throw new Error("Invalid snapshot timestamp");
    }

    const snapshotId = await saveEquitySnapshot(equity, timestamp);
    logger.info({ equity, snapshotId }, "Paper equity snapshot captured");
    return { status: "completed", equity, snapshotId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Paper equity snapshot failed");
    return { status: "failed", equity: null, error };
  }
}
