import { prisma } from "./index.js";

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
}

/**
 * Store a single AgentReport in the database.
 * Uses upsert on runId for idempotency.
 */
export async function storeAgentReport(report: AgentReportInput): Promise<void> {
  const jsonReasoning = JSON.stringify(report.reasoning);
  const jsonSupporting = JSON.stringify(report.supportingEvidence);
  const jsonOpposing = JSON.stringify(report.opposingEvidence);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "StoredAgentReport" (
      "runId", "agentId", "agentVersion", "promptVersion",
      "requestedModel", "actualModel", "asset", "horizon", "signal",
      "score", "confidence", "dataQuality",
      "reasoning", "supportingEvidence", "opposingEvidence",
      "sourceIds", "promptTokens", "completionTokens",
      "latencyMs", "estimatedCostUsd", "status"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12,
      $13::jsonb, $14::jsonb, $15::jsonb,
      $16::text[], $17, $18, $19, $20, $21
    )
    ON CONFLICT ("runId") DO UPDATE SET
      "actualModel" = EXCLUDED."actualModel",
      "score" = EXCLUDED."score",
      "confidence" = EXCLUDED."confidence",
      "dataQuality" = EXCLUDED."dataQuality",
      "reasoning" = EXCLUDED."reasoning",
      "signal" = EXCLUDED."signal",
      "status" = EXCLUDED."status",
      "promptTokens" = EXCLUDED."promptTokens",
      "completionTokens" = EXCLUDED."completionTokens",
      "latencyMs" = EXCLUDED."latencyMs",
      "estimatedCostUsd" = EXCLUDED."estimatedCostUsd"`,
    report.runId,
    report.agentId,
    report.agentVersion,
    report.promptVersion,
    report.requestedModel,
    report.actualModel,
    report.asset,
    report.horizon,
    report.signal,
    report.score,
    report.confidence,
    report.dataQuality,
    jsonReasoning,
    jsonSupporting,
    jsonOpposing,
    report.sourceIds,
    report.promptTokens,
    report.completionTokens,
    report.latencyMs,
    report.estimatedCostUsd,
    report.status,
  );
}

/**
 * Store a TradeProposal in the database.
 * Uses upsert on runId for idempotency.
 */
export async function storeTradeProposal(proposal: TradeProposalInput): Promise<void> {
  const jsonRationale = JSON.stringify(proposal.rationale);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "StoredTradeProposal" (
      "runId", "asset", "action", "confidence", "suggestedRiskFraction",
      "rationale", "reportIds", "invalidationConditions",
      "expiresAt", "status", "decisionGateResult", "riskDecisionId",
      "managerAgentVersion", "managerPromptVersion",
      "requestedModel", "actualModel",
      "promptTokens", "completionTokens", "latencyMs", "estimatedCostUsd"
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6::jsonb, $7::text[], $8::jsonb,
      $9, $10, $11, $12,
      $13, $14, $15, $16,
      $17, $18, $19, $20
    )
    ON CONFLICT ("runId") DO UPDATE SET
      "action" = EXCLUDED."action",
      "confidence" = EXCLUDED."confidence",
      "suggestedRiskFraction" = EXCLUDED."suggestedRiskFraction",
      "status" = EXCLUDED."status",
      "decisionGateResult" = EXCLUDED."decisionGateResult",
      "riskDecisionId" = EXCLUDED."riskDecisionId",
      "actualModel" = EXCLUDED."actualModel"`,
    proposal.runId,
    proposal.asset,
    proposal.action,
    proposal.confidence,
    proposal.suggestedRiskFraction,
    jsonRationale,
    proposal.reportIds,
    JSON.stringify(proposal.invalidationConditions),
    proposal.expiresAt,
    proposal.status,
    proposal.decisionGateResult ?? null,
    proposal.riskDecisionId ?? null,
    proposal.managerAgentVersion,
    proposal.managerPromptVersion,
    proposal.requestedModel,
    proposal.actualModel,
    proposal.promptTokens,
    proposal.completionTokens,
    proposal.latencyMs,
    proposal.estimatedCostUsd,
  );
}
