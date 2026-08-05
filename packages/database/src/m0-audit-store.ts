import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma-client.js";

export const M0_CONFIGURATION_KINDS = [
  "SCANNER",
  "AI",
  "RISK",
  "FEE",
  "EXECUTION",
  "SYSTEM",
] as const;

export type M0ConfigurationKind = (typeof M0_CONFIGURATION_KINDS)[number];

export interface ConfigurationSnapshotInput {
  kind: M0ConfigurationKind;
  version: string;
  payload: Record<string, unknown>;
  effectiveFrom?: Date;
  createdBy?: string;
}

export interface DecisionAuditInput {
  decisionKey: string;
  proposalRunId?: string | null;
  asset: string;
  action?: string | null;
  decisionStatus: string;
  marketInput: Record<string, unknown>;
  quantitativeFeatures: Record<string, unknown>;
  agentReportIds: string[];
  proposalJson: Record<string, unknown>;
  decisionGateResult?: string | null;
  riskDecisionId?: string | null;
  orderId?: string | null;
  configurationSnapshotIds: string[];
  promptVersion?: string | null;
  requestedModel?: string | null;
  actualModel?: string | null;
  outcomeStatus?: string;
  migrationSafe?: boolean;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return Object.fromEntries(
        Object.entries(nested as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)),
      );
    }
    return nested;
  });
}

export function hashConfigurationPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export async function upsertConfigurationSnapshot(
  input: ConfigurationSnapshotInput,
): Promise<{ id: string; version: string; payloadHash: string }> {
  const payloadHash = hashConfigurationPayload(input.payload);
  return prisma.configurationSnapshot.upsert({
    where: { kind_payloadHash: { kind: input.kind, payloadHash } },
    update: {},
    create: {
      kind: input.kind,
      version: input.version,
      payload: input.payload as Prisma.InputJsonValue,
      payloadHash,
      effectiveFrom: input.effectiveFrom,
      createdBy: input.createdBy ?? "SYSTEM",
    },
    select: { id: true, version: true, payloadHash: true },
  });
}

export async function getConfigurationSnapshots(kind?: M0ConfigurationKind) {
  return prisma.configurationSnapshot.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
}

export async function upsertDecisionAudit(input: DecisionAuditInput): Promise<string> {
  const audit = await prisma.decisionAudit.upsert({
    where: { decisionKey: input.decisionKey },
    update: {
      proposalRunId: input.proposalRunId,
      asset: input.asset,
      action: input.action,
      decisionStatus: input.decisionStatus,
      marketInput: input.marketInput as Prisma.InputJsonValue,
      quantitativeFeatures: input.quantitativeFeatures as Prisma.InputJsonValue,
      agentReportIds: input.agentReportIds,
      proposalJson: input.proposalJson as Prisma.InputJsonValue,
      decisionGateResult: input.decisionGateResult,
      riskDecisionId: input.riskDecisionId,
      orderId: input.orderId,
      configurationSnapshotIds: input.configurationSnapshotIds,
      promptVersion: input.promptVersion,
      requestedModel: input.requestedModel,
      actualModel: input.actualModel,
      outcomeStatus: input.outcomeStatus,
      migrationSafe: input.migrationSafe ?? true,
    },
    create: {
      decisionKey: input.decisionKey,
      proposalRunId: input.proposalRunId,
      asset: input.asset,
      action: input.action,
      decisionStatus: input.decisionStatus,
      marketInput: input.marketInput as Prisma.InputJsonValue,
      quantitativeFeatures: input.quantitativeFeatures as Prisma.InputJsonValue,
      agentReportIds: input.agentReportIds,
      proposalJson: input.proposalJson as Prisma.InputJsonValue,
      decisionGateResult: input.decisionGateResult,
      riskDecisionId: input.riskDecisionId,
      orderId: input.orderId,
      configurationSnapshotIds: input.configurationSnapshotIds,
      promptVersion: input.promptVersion,
      requestedModel: input.requestedModel,
      actualModel: input.actualModel,
      outcomeStatus: input.outcomeStatus ?? "PENDING",
      migrationSafe: input.migrationSafe ?? true,
    },
    select: { id: true },
  });
  return audit.id;
}

export async function getDecisionAudit(decisionKey: string) {
  return prisma.decisionAudit.findUnique({ where: { decisionKey } });
}

export async function recordOutcomeCheckpoint(input: {
  decisionAuditId: string;
  proposalRunId?: string | null;
  orderId?: string | null;
  checkpoint: string;
  referencePrice?: number | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  realizedPnl?: number;
  unrealizedPnl?: number;
  grossPnl?: number;
  fee?: number;
  slippage?: number;
  netPnl?: number;
  wasCorrect?: boolean | null;
}) {
  return prisma.outcomeLedger.upsert({
    where: {
      decisionAuditId_checkpoint: {
        decisionAuditId: input.decisionAuditId,
        checkpoint: input.checkpoint,
      },
    },
    update: {
      referencePrice: input.referencePrice,
      entryPrice: input.entryPrice,
      exitPrice: input.exitPrice,
      realizedPnl: input.realizedPnl ?? 0,
      unrealizedPnl: input.unrealizedPnl ?? 0,
      grossPnl: input.grossPnl ?? 0,
      fee: input.fee ?? 0,
      slippage: input.slippage ?? 0,
      netPnl: input.netPnl ?? 0,
      wasCorrect: input.wasCorrect,
    },
    create: {
      decisionAuditId: input.decisionAuditId,
      proposalRunId: input.proposalRunId,
      orderId: input.orderId,
      checkpoint: input.checkpoint,
      referencePrice: input.referencePrice,
      entryPrice: input.entryPrice,
      exitPrice: input.exitPrice,
      realizedPnl: input.realizedPnl ?? 0,
      unrealizedPnl: input.unrealizedPnl ?? 0,
      grossPnl: input.grossPnl ?? 0,
      fee: input.fee ?? 0,
      slippage: input.slippage ?? 0,
      netPnl: input.netPnl ?? 0,
      wasCorrect: input.wasCorrect,
    },
  });
}

export async function savePerformanceSnapshot(input: {
  realizedPnl: number;
  unrealizedPnl: number;
  dailyRealizedPnl: number;
  dailyUnrealizedPnl: number;
  cumulativeNetPnl: number;
  equity: number;
}) {
  return prisma.performanceSnapshot.create({ data: input });
}

export async function getPnlBreakdown(from: Date, to: Date) {
  const [outcomes, snapshots] = await Promise.all([
    prisma.outcomeLedger.findMany({
      where: { recordedAt: { gte: from, lte: to } },
      orderBy: { recordedAt: "asc" },
    }),
    prisma.performanceSnapshot.findMany({
      where: { recordedAt: { gte: from, lte: to } },
      orderBy: { recordedAt: "asc" },
    }),
  ]);
  return {
    realizedPnl: outcomes.reduce((sum, row) => sum + Number(row.realizedPnl), 0),
    unrealizedPnl: snapshots.at(-1) ? Number(snapshots.at(-1)!.unrealizedPnl) : 0,
    dailyRealizedPnl: snapshots.at(-1) ? Number(snapshots.at(-1)!.dailyRealizedPnl) : 0,
    dailyUnrealizedPnl: snapshots.at(-1) ? Number(snapshots.at(-1)!.dailyUnrealizedPnl) : 0,
    cumulativeNetPnl: snapshots.at(-1) ? Number(snapshots.at(-1)!.cumulativeNetPnl) : 0,
    fee: outcomes.reduce((sum, row) => sum + Number(row.fee), 0),
    slippage: outcomes.reduce((sum, row) => sum + Number(row.slippage), 0),
    outcomeCount: outcomes.length,
  };
}

