import { prisma } from "./prisma-client.js";

export interface AICallReservationInput {
  idempotencyKey: string;
  estimatedCostUsd: number;
  requestedModel: string;
  provider: string;
  jobId?: string;
  agentId?: string;
  asset?: string;
  now?: Date;
}

export interface AICallReservation {
  status: "RESERVED" | "ALREADY_RESERVED" | "DENIED";
  reservationId?: string;
  reason?: string;
}

function dayStart(now: Date): Date { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); }
function monthStart(now: Date): Date { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }

export async function getAIBudgetPolicy() {
  return prisma.aIBudgetPolicy.findUnique({ where: { singletonKey: "GLOBAL" } });
}

export async function reserveAICall(input: AICallReservationInput): Promise<AICallReservation> {
  const now = input.now ?? new Date();
  const estimated = Math.max(0, input.estimatedCostUsd);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.aICall.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.status === "RESERVED") return { status: "ALREADY_RESERVED", reservationId: existing.id };
      return { status: "DENIED", reason: `call already finalized as ${existing.status}` };
    }
    const policy = await tx.aIBudgetPolicy.findUnique({ where: { singletonKey: "GLOBAL" } });
    if (!policy || !policy.enabled) {
      const call = await tx.aICall.create({ data: { idempotencyKey: input.idempotencyKey, provider: input.provider, requestedModel: input.requestedModel, estimatedCostUsd: estimated, status: "RESERVED", jobId: input.jobId, agentId: input.agentId, asset: input.asset, reservedAt: now } });
      return { status: "RESERVED", reservationId: call.id };
    }
    const daily = await tx.aIBudgetBucket.upsert({ where: { bucketType_bucketStart: { bucketType: "DAY", bucketStart: dayStart(now) } }, update: {}, create: { bucketType: "DAY", bucketStart: dayStart(now) } });
    const monthly = await tx.aIBudgetBucket.upsert({ where: { bucketType_bucketStart: { bucketType: "MONTH", bucketStart: monthStart(now) } }, update: {}, create: { bucketType: "MONTH", bucketStart: monthStart(now) } });
    if (Number(daily.reservedUsd) + estimated > Number(policy.maxDailyUsd) || Number(monthly.reservedUsd) + estimated > Number(policy.maxMonthlyUsd)) return { status: "DENIED", reason: "AI budget exceeded" };
    await tx.aIBudgetBucket.update({ where: { id: daily.id }, data: { reservedUsd: { increment: estimated } } });
    await tx.aIBudgetBucket.update({ where: { id: monthly.id }, data: { reservedUsd: { increment: estimated } } });
    const call = await tx.aICall.create({ data: { idempotencyKey: input.idempotencyKey, reservationId: input.idempotencyKey, provider: input.provider, requestedModel: input.requestedModel, estimatedCostUsd: estimated, status: "RESERVED", jobId: input.jobId, agentId: input.agentId, asset: input.asset, reservedAt: now } });
    return { status: "RESERVED", reservationId: call.id };
  });
}

export async function settleAICall(input: { reservationId: string; actualCostUsd: number; promptTokens: number; completionTokens: number; latencyMs: number; actualModel: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    const call = await tx.aICall.findUnique({ where: { id: input.reservationId } });
    if (!call || call.status === "SUCCEEDED") return;
    await tx.aICall.update({ where: { id: call.id }, data: { status: "SUCCEEDED", actualCostUsd: Math.max(0, input.actualCostUsd), promptTokens: input.promptTokens, completionTokens: input.completionTokens, latencyMs: input.latencyMs, actualModel: input.actualModel, settledAt: now } });
    const delta = Math.max(0, Number(call.estimatedCostUsd) - Math.max(0, input.actualCostUsd));
    if (delta > 0) {
      const daily = await tx.aIBudgetBucket.findUnique({ where: { bucketType_bucketStart: { bucketType: "DAY", bucketStart: dayStart(call.reservedAt ?? now) } } });
      const monthly = await tx.aIBudgetBucket.findUnique({ where: { bucketType_bucketStart: { bucketType: "MONTH", bucketStart: monthStart(call.reservedAt ?? now) } } });
      if (daily) await tx.aIBudgetBucket.update({ where: { id: daily.id }, data: { reservedUsd: { decrement: delta }, releasedUsd: { increment: delta }, settledUsd: { increment: Math.max(0, input.actualCostUsd) } } });
      if (monthly) await tx.aIBudgetBucket.update({ where: { id: monthly.id }, data: { reservedUsd: { decrement: delta }, releasedUsd: { increment: delta }, settledUsd: { increment: Math.max(0, input.actualCostUsd) } } });
    }
  });
}

export async function releaseAICall(reservationId: string, reason: string, now = new Date()): Promise<void> {
  await prisma.aICall.updateMany({ where: { id: reservationId, status: "RESERVED" }, data: { status: "RELEASED", errorMessage: reason, settledAt: now } });
}

