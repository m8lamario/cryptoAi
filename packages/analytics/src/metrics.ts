import { prisma } from "@cryptoai/database";

/**
 * Phase 5 — Analytics & Evaluation.
 *
 * Computes performance metrics for AI agents, models, and prompts.
 * Data source: StoredAgentReport and StoredTradeProposal tables.
 */

// --- Agent Performance ---

export interface AgentPerformanceMetrics {
  agentId: string;
  totalReports: number;
  validCount: number;
  unavailableCount: number;
  invalidCount: number;
  /** Percentage of valid JSON outputs */
  validJsonRate: number;
  /** Fallback/unavailable rate */
  fallbackRate: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** Total estimated cost in USD */
  totalCostUsd: number;
  /** Average confidence (VALID reports only) */
  avgConfidence: number;
  /** Average score (VALID reports only) */
  avgScore: number;
  /** Signal distribution: BUY / SELL / HOLD / WAIT */
  signalDistribution: Record<string, number>;
  /** Model accuracy: % of times actualModel matches requestedModel */
  modelAccuracy: number;
}

export async function getAgentPerformance(
  agentId: string,
  since: Date = new Date(Date.now() - 7 * 86400_000),
): Promise<AgentPerformanceMetrics> {
  const reports = await prisma.storedAgentReport.findMany({
    where: { agentId, createdAt: { gte: since } },
  });

  const total = reports.length;
  const valid = reports.filter((r) => r.status === "VALID");
  const unavailable = reports.filter((r) => r.status === "UNAVAILABLE");
  const invalid = reports.filter((r) => r.status === "INVALID");

  const signalDist: Record<string, number> = {};
  for (const r of valid) {
    if (r.signal) {
      signalDist[r.signal] = (signalDist[r.signal] ?? 0) + 1;
    }
  }

  const modelMatch = reports.filter(
    (r) => r.requestedModel === r.actualModel,
  ).length;

  return {
    agentId,
    totalReports: total,
    validCount: valid.length,
    unavailableCount: unavailable.length,
    invalidCount: invalid.length,
    validJsonRate: total > 0 ? valid.length / total : 0,
    fallbackRate: total > 0 ? (unavailable.length + invalid.length) / total : 0,
    avgLatencyMs:
      total > 0
        ? Math.round(reports.reduce((s, r) => s + r.latencyMs, 0) / total)
        : 0,
    totalCostUsd:
      Math.round(
        reports.reduce((s, r) => s + Number(r.estimatedCostUsd), 0) * 1_000_000,
      ) / 1_000_000,
    avgConfidence:
      valid.length > 0
        ? Math.round(
            (valid.reduce((s, r) => s + Number(r.confidence), 0) / valid.length) * 100,
          ) / 100
        : 0,
    avgScore:
      valid.length > 0
        ? Math.round(
            (valid.reduce((s, r) => s + Number(r.score), 0) / valid.length) * 100,
          ) / 100
        : 0,
    signalDistribution: signalDist,
    modelAccuracy: total > 0 ? modelMatch / total : 0,
  };
}

// --- Model Performance ---

export interface ModelPerformanceMetrics {
  model: string;
  totalCalls: number;
  validOutputs: number;
  validRate: number;
  avgLatencyMs: number;
  avgTokensPerCall: number;
  totalCostUsd: number;
}

export async function getModelPerformance(
  model?: string,
  since: Date = new Date(Date.now() - 7 * 86400_000),
): Promise<ModelPerformanceMetrics[]> {
  const where: Record<string, unknown> = { createdAt: { gte: since } };
  if (model) {
    where["requestedModel"] = model;
  }

  const reports = await prisma.storedAgentReport.findMany({
    where,
    select: {
      requestedModel: true,
      actualModel: true,
      status: true,
      latencyMs: true,
      promptTokens: true,
      completionTokens: true,
      estimatedCostUsd: true,
    },
  });

  const byModel = new Map<string, typeof reports>();

  for (const r of reports) {
    const m = r.actualModel ?? r.requestedModel;
    if (!byModel.has(m)) byModel.set(m, []);
    byModel.get(m)!.push(r);
  }

  const results: ModelPerformanceMetrics[] = [];

  for (const [modelName, calls] of byModel) {
    const valid = calls.filter((c) => c.status === "VALID");
    results.push({
      model: modelName,
      totalCalls: calls.length,
      validOutputs: valid.length,
      validRate: calls.length > 0 ? valid.length / calls.length : 0,
      avgLatencyMs:
        calls.length > 0
          ? Math.round(calls.reduce((s, c) => s + c.latencyMs, 0) / calls.length)
          : 0,
      avgTokensPerCall:
        calls.length > 0
          ? Math.round(
              calls.reduce((s, c) => s + c.promptTokens + c.completionTokens, 0) /
                calls.length,
            )
          : 0,
      totalCostUsd:
        Math.round(
          calls.reduce((s, c) => s + Number(c.estimatedCostUsd), 0) * 1_000_000,
        ) / 1_000_000,
    });
  }

  return results.sort((a, b) => b.totalCalls - a.totalCalls);
}

// --- Prompt Version Performance ---

export interface PromptVersionMetrics {
  agentId: string;
  promptVersion: string;
  totalCalls: number;
  validRate: number;
  avgConfidence: number;
  avgScore: number;
  avgLatencyMs: number;
}

export async function getPromptVersionPerformance(
  agentId?: string,
  since: Date = new Date(Date.now() - 7 * 86400_000),
): Promise<PromptVersionMetrics[]> {
  const where: Record<string, unknown> = { createdAt: { gte: since } };
  if (agentId) {
    where["agentId"] = agentId;
  }

  const reports = await prisma.storedAgentReport.findMany({
    where,
    select: {
      agentId: true,
      promptVersion: true,
      status: true,
      confidence: true,
      score: true,
      latencyMs: true,
    },
  });

  const key = (a: string, p: string) => `${a}::${p}`;
  const byPrompt = new Map<string, typeof reports>();

  for (const r of reports) {
    const k = key(r.agentId, r.promptVersion);
    if (!byPrompt.has(k)) byPrompt.set(k, []);
    byPrompt.get(k)!.push(r);
  }

  const results: PromptVersionMetrics[] = [];
  for (const [, calls] of byPrompt) {
    const valid = calls.filter((c) => c.status === "VALID");
    results.push({
      agentId: calls[0]!.agentId,
      promptVersion: calls[0]!.promptVersion,
      totalCalls: calls.length,
      validRate: calls.length > 0 ? valid.length / calls.length : 0,
      avgConfidence:
        valid.length > 0
          ? Math.round((valid.reduce((s, c) => s + Number(c.confidence), 0) / valid.length) * 100) / 100
          : 0,
      avgScore:
        valid.length > 0
          ? Math.round((valid.reduce((s, c) => s + Number(c.score), 0) / valid.length) * 100) / 100
          : 0,
      avgLatencyMs:
        calls.length > 0
          ? Math.round(calls.reduce((s, c) => s + c.latencyMs, 0) / calls.length)
          : 0,
    });
  }

  return results.sort((a, b) => b.totalCalls - a.totalCalls);
}

// --- Overall System Stats ---

export interface SystemStats {
  totalAgentReports: number;
  totalProposals: number;
  totalRiskDecisions: number;
  approvedCount: number;
  blockedCount: number;
  totalAiCostUsd: number;
  /** Reports by status */
  reportStatusBreakdown: Record<string, number>;
  /** Proposals by status */
  proposalStatusBreakdown: Record<string, number>;
}

export async function getSystemStats(
  since: Date = new Date(Date.now() - 24 * 3600_000),
): Promise<SystemStats> {
  const [reports, proposals, decisions] = await Promise.all([
    prisma.storedAgentReport.findMany({ where: { createdAt: { gte: since } } }),
    prisma.storedTradeProposal.findMany({ where: { createdAt: { gte: since } } }),
    prisma.riskDecision.findMany({ where: { createdAt: { gte: since } } }),
  ]);

  const reportBreakdown: Record<string, number> = {};
  for (const r of reports) {
    reportBreakdown[r.status] = (reportBreakdown[r.status] ?? 0) + 1;
  }

  const proposalBreakdown: Record<string, number> = {};
  for (const p of proposals) {
    proposalBreakdown[p.status] = (proposalBreakdown[p.status] ?? 0) + 1;
  }

  const approved = decisions.filter((d) => d.status === "APPROVE");
  const blocked = decisions.filter((d) => d.status === "BLOCK");

  const reportCost = reports.reduce((s, r) => s + Number(r.estimatedCostUsd), 0);
  const proposalCost = proposals.reduce((s, p) => s + Number(p.estimatedCostUsd), 0);

  return {
    totalAgentReports: reports.length,
    totalProposals: proposals.length,
    totalRiskDecisions: decisions.length,
    approvedCount: approved.length,
    blockedCount: blocked.length,
    totalAiCostUsd:
      Math.round((reportCost + proposalCost) * 1_000_000) / 1_000_000,
    reportStatusBreakdown: reportBreakdown,
    proposalStatusBreakdown: proposalBreakdown,
  };
}

