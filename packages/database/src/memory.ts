import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma-client.js";

/**
 * Phase 5 — Memory & Persistence.
 *
 * Persists AgentReports and TradeProposals to PostgreSQL for audit and evaluation.
 */

export interface AgentReportInput {
  runId: string;
  agentId: string;
  agentVersion: string;
  promptVersion: string;
  requestedModel: string;
  actualModel: string | null;
  asset: string;
  horizon: string;
  signal: string | null;
  score: number;
  confidence: number;
  dataQuality: number;
  reasoning: string[];
  supportingEvidence: string[];
  opposingEvidence: string[];
  sourceIds: string[];
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  status: string;
}

export interface TradeProposalInput {
  runId: string;
  asset: string;
  action: string | null;
  confidence: number;
  suggestedRiskFraction: number | null;
  rationale: string[];
  reportIds: string[];
  invalidationConditions: string[];
  expiresAt: Date | null;
  status: string;
  decisionGateResult?: string | null;
  riskDecisionId?: string | null;
  managerAgentVersion: string;
  managerPromptVersion: string;
  requestedModel: string;
  actualModel: string | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  tradingPlan?: Record<string, unknown> | null;
  contractVersion?: string;
}

/**
 * Store a single AgentReport in the database.
 * Uses upsert on runId for idempotency.
 */
export async function storeAgentReport(report: AgentReportInput): Promise<void> {
  await prisma.storedAgentReport.upsert({
    where: { runId: report.runId },
    create: {
      runId: report.runId,
      agentId: report.agentId,
      agentVersion: report.agentVersion,
      promptVersion: report.promptVersion,
      requestedModel: report.requestedModel,
      actualModel: report.actualModel,
      asset: report.asset,
      horizon: report.horizon,
      signal: report.signal,
      score: report.score,
      confidence: report.confidence,
      dataQuality: report.dataQuality,
      reasoning: report.reasoning,
      supportingEvidence: report.supportingEvidence,
      opposingEvidence: report.opposingEvidence,
      sourceIds: report.sourceIds,
      promptTokens: report.promptTokens,
      completionTokens: report.completionTokens,
      latencyMs: report.latencyMs,
      estimatedCostUsd: report.estimatedCostUsd,
      status: report.status,
    },
    update: {
      actualModel: report.actualModel,
      score: report.score,
      confidence: report.confidence,
      dataQuality: report.dataQuality,
      reasoning: report.reasoning,
      signal: report.signal,
      status: report.status,
      promptTokens: report.promptTokens,
      completionTokens: report.completionTokens,
      latencyMs: report.latencyMs,
      estimatedCostUsd: report.estimatedCostUsd,
    },
  });
}

/**
 * Store a TradeProposal in the database.
 * Uses upsert on runId for idempotency.
 */
export async function storeTradeProposal(proposal: TradeProposalInput): Promise<void> {
  await prisma.storedTradeProposal.upsert({
    where: { runId: proposal.runId },
    create: {
      runId: proposal.runId,
      asset: proposal.asset,
      action: proposal.action,
      confidence: proposal.confidence,
      suggestedRiskFraction: proposal.suggestedRiskFraction,
      rationale: proposal.rationale,
      reportIds: proposal.reportIds,
      invalidationConditions: proposal.invalidationConditions,
      expiresAt: proposal.expiresAt,
      status: proposal.status,
      decisionGateResult: proposal.decisionGateResult ?? null,
      riskDecisionId: proposal.riskDecisionId ?? null,
      managerAgentVersion: proposal.managerAgentVersion,
      managerPromptVersion: proposal.managerPromptVersion,
      requestedModel: proposal.requestedModel,
      actualModel: proposal.actualModel,
      promptTokens: proposal.promptTokens,
      completionTokens: proposal.completionTokens,
      latencyMs: proposal.latencyMs,
      estimatedCostUsd: proposal.estimatedCostUsd,
      tradingPlan: proposal.tradingPlan
        ? proposal.tradingPlan as Prisma.InputJsonValue
        : undefined,
      contractVersion: proposal.contractVersion,
    },
    update: {
      action: proposal.action,
      confidence: proposal.confidence,
      suggestedRiskFraction: proposal.suggestedRiskFraction,
      status: proposal.status,
      decisionGateResult: proposal.decisionGateResult ?? null,
      riskDecisionId: proposal.riskDecisionId ?? null,
      actualModel: proposal.actualModel,
    },
  });
}
