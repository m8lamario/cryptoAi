import { prisma } from "./prisma-client.js";
import type { Prisma } from "@prisma/client";

const CHECKPOINTS = [
  "AT_OPEN", "AFTER_1H", "AFTER_6H", "AFTER_24H", "AFTER_7D", "AFTER_30D",
] as const;

export type MemoryCheckpoint = (typeof CHECKPOINTS)[number];

export interface AIDecisionMemoryInput {
  proposalRunId: string;
  asset: string;
  action: "BUY" | "SELL";
  strategy: string | null;
  entryPrice: number;
  indicatorsJson: Record<string, unknown>;
  modelUsed: string;
  promptVersion: string;
  confidenceAtDecision: number;
  decidedAt: Date;
}

export interface MemoryOutcomeInput {
  checkpoint: MemoryCheckpoint;
  profitLossPercent: number;
  wasCorrect: boolean | null;
  priceAtCheckpoint: number;
  recordedAt: Date;
}

/**
 * Store a new AI Decision Memory entry.
 * Uses upsert on proposalRunId for idempotency.
 */
export async function storeDecisionMemory(entry: AIDecisionMemoryInput): Promise<string> {
  const result = await prisma.aIDecisionMemory.upsert({
    where: { proposalRunId: entry.proposalRunId },
    create: {
      proposalRunId: entry.proposalRunId,
      asset: entry.asset,
      action: entry.action,
      strategy: entry.strategy,
      entryPrice: entry.entryPrice,
      indicatorsJson: entry.indicatorsJson as Prisma.InputJsonValue,
      modelUsed: entry.modelUsed,
      promptVersion: entry.promptVersion,
      confidenceAtDecision: entry.confidenceAtDecision,
      decidedAt: entry.decidedAt,
      outcomes: [] as Prisma.InputJsonValue,
      finalResult: null,
    },
    update: {
      action: entry.action,
      strategy: entry.strategy,
      entryPrice: entry.entryPrice,
      indicatorsJson: entry.indicatorsJson as Prisma.InputJsonValue,
      modelUsed: entry.modelUsed,
      promptVersion: entry.promptVersion,
      confidenceAtDecision: entry.confidenceAtDecision,
    },
  });

  return result.id;
}

/**
 * Add an outcome checkpoint to an existing decision memory.
 */
export async function addMemoryOutcome(
  proposalRunId: string,
  outcome: MemoryOutcomeInput,
): Promise<void> {
  const existing = await prisma.aIDecisionMemory.findUnique({
    where: { proposalRunId },
  });

  if (!existing) return;

  const outcomes = (existing.outcomes as unknown as MemoryOutcomeInput[]) ?? [];
  outcomes.push(outcome);

  await prisma.aIDecisionMemory.update({
    where: { proposalRunId },
    data: { outcomes: outcomes as unknown as Prisma.InputJsonValue },
  });
}

/**
 * Set the final result for a decision memory.
 */
export async function finalizeDecisionMemory(
  proposalRunId: string,
  finalResult: number,
): Promise<void> {
  await prisma.aIDecisionMemory.update({
    where: { proposalRunId },
    data: { finalResult },
  });
}

/**
 * Find all decision memories that need a specific checkpoint evaluation.
 */
export async function findPendingCheckpoints(
  checkpoint: MemoryCheckpoint,
  timingMs: number,
  now: Date = new Date(),
): Promise<Array<{ proposalRunId: string; asset: string; action: string; entryPrice: number; decidedAt: Date }>> {
  const checkpoints = await prisma.aIDecisionMemory.findMany({
    where: {
      decidedAt: { not: undefined },
      finalResult: null,
    },
    select: {
      proposalRunId: true,
      asset: true,
      action: true,
      entryPrice: true,
      decidedAt: true,
      outcomes: true,
    },
  });

  return checkpoints
    .filter((entry) => {
      const cutoff = new Date(entry.decidedAt.getTime() + timingMs);
      if (now < cutoff) return false;

      const outcomes = (entry.outcomes as unknown as MemoryOutcomeInput[]) ?? [];
      const hasCheckpoint = outcomes.some((o) => o.checkpoint === checkpoint);
      return !hasCheckpoint;
    })
    .map((entry) => ({
      proposalRunId: entry.proposalRunId,
      asset: entry.asset,
      action: entry.action,
      entryPrice: Number(entry.entryPrice),
      decidedAt: entry.decidedAt,
    }));
}

/**
 * Get all decision memories for analytics/display.
 */
export async function getDecisionMemories(limit = 50): Promise<Array<{
  id: string;
  proposalRunId: string;
  asset: string;
  action: string;
  strategy: string | null;
  entryPrice: number;
  modelUsed: string;
  confidenceAtDecision: number;
  decidedAt: Date;
  outcomes: MemoryOutcomeInput[];
  finalResult: number | null;
}>> {
  const entries = await prisma.aIDecisionMemory.findMany({
    orderBy: { decidedAt: "desc" },
    take: limit,
  });

  return entries.map((e) => ({
    id: e.id,
    proposalRunId: e.proposalRunId,
    asset: e.asset,
    action: e.action,
    strategy: e.strategy,
    entryPrice: Number(e.entryPrice),
    modelUsed: e.modelUsed,
    confidenceAtDecision: Number(e.confidenceAtDecision),
    decidedAt: e.decidedAt,
    outcomes: (e.outcomes as unknown as MemoryOutcomeInput[]) ?? [],
    finalResult: e.finalResult ? Number(e.finalResult) : null,
  }));
}
