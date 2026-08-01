import {
  getEquityHistory,
  prisma,
  type EquityHistoryInterval,
} from "@cryptoai/database";
import type {
  DashboardAgentStatus,
  DashboardAiCostSummary,
  DashboardChartPoint,
  DashboardKpiResponse,
  DashboardTimelineEvent,
} from "@cryptoai/contracts";
import { getOperatingMode } from "@cryptoai/risk-engine";

export const DASHBOARD_AGENT_DEFINITIONS = [
  { agentId: "technical-agent", label: "Technical" },
  { agentId: "news-agent", label: "News" },
  { agentId: "sentiment-agent", label: "Sentiment" },
  { agentId: "whale-agent", label: "Whale" },
  { agentId: "macro-agent", label: "Macro" },
] as const;

const MANAGER_COST_ENTRY = { agentId: "manager-agent", label: "Investment Manager" } as const;

export async function fetchEquityHistory(
  from: Date,
  to: Date,
  interval: EquityHistoryInterval,
): Promise<DashboardChartPoint[]> {
  const points = await getEquityHistory(from, to, interval);
  return points.map((point) => ({ timestamp: point.timestamp.toISOString(), equity: point.equity }));
}

export async function fetchTimeline(
  asset: string | undefined,
  limit: number,
): Promise<DashboardTimelineEvent[]> {
  const [orders, memories, systemEvents] = await Promise.all([
    prisma.paperOrder.findMany({
      where: { status: "FILLED", ...(asset ? { asset } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, asset: true, side: true, quantity: true, price: true, createdAt: true, executedAt: true },
    }),
    prisma.aIDecisionMemory.findMany({
      where: asset ? { asset } : undefined,
      orderBy: { decidedAt: "desc" },
      take: limit,
      select: { id: true, asset: true, action: true, confidenceAtDecision: true, decidedAt: true },
    }),
    prisma.systemEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, type: true, message: true, level: true, createdAt: true },
    }),
  ]);

  const events: DashboardTimelineEvent[] = [
    ...orders.map((order) => ({
      id: `order:${order.id}`,
      type: order.side === "BUY" ? "TRADE_OPEN" as const : "TRADE_CLOSE" as const,
      asset: order.asset,
      description: `${order.side === "BUY" ? "Opened" : "Closed"} paper position`,
      amount: Number(order.quantity) * Number(order.price),
      timestamp: (order.executedAt ?? order.createdAt).toISOString(),
    })),
    ...memories.map((memory) => ({
      id: `decision:${memory.id}`,
      type: "AI_DECISION" as const,
      asset: memory.asset,
      description: `${memory.action} decision at ${Math.round(Number(memory.confidenceAtDecision) * 100)}% confidence`,
      timestamp: memory.decidedAt.toISOString(),
    })),
    ...systemEvents.map((event) => ({
      id: `system:${event.id}`,
      type: "SYSTEM" as const,
      description: `[${event.level}] ${event.type}: ${event.message}`,
      timestamp: event.createdAt.toISOString(),
    })),
  ];

  return events
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, limit);
}

export async function fetchAgentStatuses(now = new Date()): Promise<DashboardAgentStatus[]> {
  const reports = await prisma.storedAgentReport.findMany({
    where: { agentId: { in: DASHBOARD_AGENT_DEFINITIONS.map((agent) => agent.agentId) } },
    orderBy: { createdAt: "desc" },
    take: DASHBOARD_AGENT_DEFINITIONS.length * 10,
    select: { agentId: true, status: true, actualModel: true, createdAt: true },
  });

  return DASHBOARD_AGENT_DEFINITIONS.map((definition) => {
    const report = reports.find((candidate) => candidate.agentId === definition.agentId);
    if (!report) {
      return { ...definition, status: "RED", lastReportAt: null, modelUsed: null };
    }

    const ageMs = Math.max(0, now.getTime() - report.createdAt.getTime());
    const status = report.status !== "VALID"
      ? "RED"
      : ageMs <= 30 * 60 * 1000
        ? "GREEN"
        : ageMs <= 6 * 60 * 60 * 1000
          ? "YELLOW"
          : "RED";

    return {
      ...definition,
      status,
      lastReportAt: report.createdAt.toISOString(),
      modelUsed: report.actualModel,
    };
  });
}

function toCostEntry(
  agentId: string,
  label: string,
  calls: number,
  promptTokens: number,
  completionTokens: number,
  costUsd: number,
  latencyMs: number,
) {
  return {
    agentId,
    label,
    calls,
    promptTokens,
    completionTokens,
    costUsd: round(costUsd, 6),
    avgLatencyMs: round(latencyMs / Math.max(1, calls), 2),
  };
}

export async function fetchAiCostSummary(): Promise<DashboardAiCostSummary> {
  const [reportGroups, proposalGroups] = await Promise.all([
    prisma.storedAgentReport.groupBy({
      by: ["agentId"],
      _count: { _all: true },
      _sum: { estimatedCostUsd: true, promptTokens: true, completionTokens: true, latencyMs: true },
    }),
    prisma.storedTradeProposal.aggregate({
      _count: { _all: true },
      _sum: { estimatedCostUsd: true, promptTokens: true, completionTokens: true, latencyMs: true },
    }),
  ]);

  const entries = [
    ...DASHBOARD_AGENT_DEFINITIONS.map((definition) => {
      const group = reportGroups.find((candidate) => candidate.agentId === definition.agentId);
      return toCostEntry(
        definition.agentId,
        definition.label,
        group?._count._all ?? 0,
        group?._sum.promptTokens ?? 0,
        group?._sum.completionTokens ?? 0,
        Number(group?._sum.estimatedCostUsd ?? 0),
        group?._sum.latencyMs ?? 0,
      );
    }),
    toCostEntry(
      MANAGER_COST_ENTRY.agentId,
      MANAGER_COST_ENTRY.label,
      proposalGroups._count._all,
      proposalGroups._sum.promptTokens ?? 0,
      proposalGroups._sum.completionTokens ?? 0,
      Number(proposalGroups._sum.estimatedCostUsd ?? 0),
      proposalGroups._sum.latencyMs ?? 0,
    ),
  ];

  const totals = entries.reduce(
    (sum, entry) => ({
      calls: sum.calls + entry.calls,
      promptTokens: sum.promptTokens + entry.promptTokens,
      completionTokens: sum.completionTokens + entry.completionTokens,
      costUsd: sum.costUsd + entry.costUsd,
      latencyMs: sum.latencyMs + entry.avgLatencyMs * entry.calls,
    }),
    { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0 },
  );

  return {
    totalCostUsd: round(totals.costUsd, 6),
    totalPromptTokens: totals.promptTokens,
    totalCompletionTokens: totals.completionTokens,
    avgLatencyMs: round(totals.latencyMs / Math.max(1, totals.calls), 2),
    // A budget is intentionally null until a configured AI budget exists.
    budgetRemainingUsd: null,
    byAgent: entries,
  };
}

export function calculateDashboardKpis(input: {
  equity: number;
  dailyPnl: number;
  history: DashboardChartPoint[];
  latestProposal: { status: string; createdAt: Date } | null;
  operatingMode: DashboardKpiResponse["operatingMode"];
}): DashboardKpiResponse {
  const initialEquity = input.history[0]?.equity ?? input.equity;
  const totalPnl = input.equity - initialEquity;
  const totalPnlPercent = initialEquity > 0 ? (totalPnl / initialEquity) * 100 : 0;
  const dailyBase = input.equity - input.dailyPnl;
  const peak = input.history.reduce((highest, point) => Math.max(highest, point.equity), initialEquity);
  const maxDrawdown = peak > 0 ? Math.max(0, ((peak - input.equity) / peak) * 100) : null;

  let aiStatus: DashboardKpiResponse["aiStatus"] = "IDLE";
  if (input.latestProposal) {
    const ageMs = Date.now() - input.latestProposal.createdAt.getTime();
    if (["UNAVAILABLE", "INVALID"].includes(input.latestProposal.status)) {
      aiStatus = "ERROR";
    } else if (ageMs <= 60 * 60 * 1000) {
      aiStatus = "ACTIVE";
    }
  }

  return {
    equity: round(input.equity, 2),
    totalPnl: round(totalPnl, 2),
    totalPnlPercent: round(totalPnlPercent, 2),
    dailyPnl: round(input.dailyPnl, 2),
    dailyPnlPercent: round(dailyBase > 0 ? (input.dailyPnl / dailyBase) * 100 : 0, 2),
    roi: round(totalPnlPercent, 2),
    winRate: null,
    profitFactor: null,
    sharpeRatio: null,
    sortinoRatio: null,
    maxDrawdown: maxDrawdown === null ? null : round(maxDrawdown, 2),
    aiStatus,
    operatingMode: input.operatingMode,
  };
}

export async function getPersistedOperatingMode(): Promise<DashboardKpiResponse["operatingMode"]> {
  const config = await prisma.operatingModeConfig.findFirst({ select: { mode: true } });
  const mode = config?.mode ?? getOperatingMode();
  return mode === "ASSISTED" || mode === "AUTONOMOUS" ? mode : "PAPER";
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
