import { Router } from "express";
import { prisma } from "@cryptoai/database";
import { logger } from "../logger.js";
import type { Request, Response } from "express";
import {
  calculateDashboardKpis,
  fetchAgentStatuses,
  fetchAiCostSummary,
  fetchEquityHistory,
  fetchTimeline,
  getPersistedOperatingMode,
} from "../dashboard-data.js";
import { getPnlBreakdown } from "@cryptoai/analytics";

export function createDashboardRouter(): Router {
  const router = Router();

  /**
   * GET /private/dashboard
   * Aggregated dashboard data for all screens.
   */
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const [
        assets,
        latestSnapshots,
        lastCollectionRun,
        lastAgentReports,
        lastProposals,
        lastRiskDecisions,
        killSwitch,
        riskProfile,
        systemEvents,
        paperBalance,
        paperPositions,
        latestBacktestRuns,
      ] = await Promise.all([
        prisma.asset.findMany({ where: { active: true }, select: { id: true, symbol: true } }),
        getLatestSnapshots(),
        prisma.dataCollectionRun.findFirst({ orderBy: { startedAt: "desc" } }),
        prisma.storedAgentReport.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
        prisma.storedTradeProposal.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
        prisma.riskDecision.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
        prisma.killSwitch.findFirst({ orderBy: { updatedAt: "desc" } }),
        prisma.riskProfile.findFirst(),
        prisma.systemEvent.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.paperBalance.findFirst(),
        prisma.paperPosition.findMany({ where: { status: "OPEN" }, orderBy: { openedAt: "asc" } }),
        prisma.backtestRun.findMany({ orderBy: { createdAt: "desc" }, take: 3 }),
      ]);

      const paperPositionsResponse = paperPositions.map((position) => ({
        asset: position.asset,
        side: position.side,
        quantity: Number(position.quantity),
        entryPrice: Number(position.entryPrice),
        currentPrice: Number(position.currentPrice),
        unrealizedPnl: Number(position.unrealizedPnl),
        stopLoss: position.stopLoss === null ? null : Number(position.stopLoss),
      }));
      const paperExposure = paperPositionsResponse.reduce(
        (sum, position) => sum + position.quantity * position.currentPrice,
        0,
      );

      const historyFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [equityHistory, timeline, agentStatuses, aiCostSummary, operatingMode, pnlBreakdown] = await Promise.all([
        fetchEquityHistory(historyFrom, new Date(), "1h"),
        fetchTimeline(undefined, 30),
        fetchAgentStatuses(),
        fetchAiCostSummary(),
        getPersistedOperatingMode(),
        getPnlBreakdown(historyFrom, new Date()),
      ]);
      const paperEquity = Number(paperBalance?.quote ?? 0) + paperExposure;
      const kpis = calculateDashboardKpis({
        equity: paperEquity,
        dailyPnl: Number(paperBalance?.dailyPnl ?? 0),
        history: equityHistory,
        latestProposal: lastProposals[0]
          ? { status: lastProposals[0].status, createdAt: lastProposals[0].createdAt }
          : null,
        operatingMode,
      });

      res.json({
        systemStatus: {
          healthy: true,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        marketData: {
          snapshots: latestSnapshots.map((s) => ({
            symbol: s.symbol,
            price: Number(s.price),
            change24h: s.change24h ? Number(s.change24h) : null,
            volume24h: s.volume24h ? Number(s.volume24h) : null,
            high24h: s.high24h ? Number(s.high24h) : null,
            low24h: s.low24h ? Number(s.low24h) : null,
            collectedAt: s.collectedAt instanceof Date ? s.collectedAt.toISOString() : String(s.collectedAt),
          })),
          collectionStatus: lastCollectionRun
            ? {
                id: lastCollectionRun.id,
                status: lastCollectionRun.status,
                startedAt: lastCollectionRun.startedAt.toISOString(),
                endedAt: lastCollectionRun.endedAt?.toISOString() ?? null,
                provider: lastCollectionRun.provider,
                error: lastCollectionRun.error,
              }
            : null,
          assetCount: assets.length,
        },
        agentReports: lastAgentReports.map((r) => ({
          runId: r.runId,
          agentId: r.agentId,
          asset: r.asset,
          signal: r.signal,
          score: Number(r.score),
          confidence: Number(r.confidence),
          status: r.status,
          horizon: r.horizon,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          latencyMs: r.latencyMs,
          estimatedCostUsd: Number(r.estimatedCostUsd),
          createdAt: r.createdAt.toISOString(),
        })),
        proposals: lastProposals.map((p) => ({
          runId: p.runId,
          asset: p.asset,
          action: p.action,
          confidence: Number(p.confidence),
          status: p.status,
          decisionGateResult: p.decisionGateResult,
          suggestedRiskFraction: p.suggestedRiskFraction ? Number(p.suggestedRiskFraction) : null,
          createdAt: p.createdAt.toISOString(),
        })),
        riskDecisions: lastRiskDecisions.map((d) => ({
          id: d.id,
          status: d.status,
          ruleCode: d.ruleCode,
          reason: d.reason,
          asset: d.asset,
          positionSize: d.positionSize ? Number(d.positionSize) : null,
          stopLoss: d.stopLoss ? Number(d.stopLoss) : null,
          createdAt: d.createdAt.toISOString(),
        })),
        killSwitch: killSwitch
          ? {
              active: killSwitch.active,
              reason: killSwitch.reason,
              updatedAt: killSwitch.updatedAt.toISOString(),
            }
          : { active: false, reason: null, updatedAt: new Date().toISOString() },
        riskConfig: riskProfile
          ? {
              maxPortfolioExposurePercent: Number(riskProfile.maxPortfolioExposurePercent),
              maxAssetExposurePercent: Number(riskProfile.maxAssetExposurePercent),
              maxDailyLossPercent: Number(riskProfile.maxDailyLossPercent),
              maxDrawdownPercent: Number(riskProfile.maxDrawdownPercent),
            }
          : null,
        aiCosts: {
          totalCostUsd: aiCostSummary.totalCostUsd,
          totalPromptTokens: aiCostSummary.totalPromptTokens,
          totalCompletionTokens: aiCostSummary.totalCompletionTokens,
          avgLatencyMs: aiCostSummary.avgLatencyMs,
          budgetRemainingUsd: aiCostSummary.budgetRemainingUsd,
          byAgent: aiCostSummary.byAgent,
        },
        auditLog: systemEvents.map((e) => ({
          id: e.id,
          level: e.level,
          type: e.type,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
        paperPortfolio: {
          balance: Number(paperBalance?.quote ?? 0),
          peakValue: Number(paperBalance?.peakValue ?? 0),
          dailyPnl: Number(paperBalance?.dailyPnl ?? 0),
          totalExposure: paperExposure,
          totalValue: Number(paperBalance?.quote ?? 0) + paperExposure,
          positions: paperPositionsResponse,
        },
        kpis,
        equityHistory,
        timeline,
        agentStatuses,
        aiCostSummary,
        backtestRuns: latestBacktestRuns.map((run) => ({
          id: run.id,
          strategy: run.strategy,
          asset: run.asset,
          startDate: run.startDate.toISOString(),
          endDate: run.endDate.toISOString(),
          initialQuote: Number(run.initialQuote),
          finalQuote: Number(run.finalQuote),
          totalReturn: Number(run.totalReturn),
          maxDrawdown: Number(run.maxDrawdown),
          sharpeRatio: run.sharpeRatio === null ? null : Number(run.sharpeRatio),
          sortinoRatio: run.sortinoRatio === null ? null : Number(run.sortinoRatio),
          totalTrades: run.totalTrades,
          aiCostUsd: Number(run.aiCostUsd),
          createdAt: run.createdAt.toISOString(),
        })),
        pnlBreakdown,
        migrationSafe: true,
        configurationSnapshotCount: await prisma.configurationSnapshot.count(),
        latestDecisionAuditAt: (await prisma.decisionAudit.findFirst({ orderBy: { createdAt: "desc" } }))?.createdAt.toISOString() ?? null,
      });
    } catch (err) {
      logger.error({ err }, "Failed to fetch dashboard data");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

async function getLatestSnapshots() {
  const assets = await prisma.asset.findMany({
    where: { active: true },
    select: { id: true },
  });
  const ids = assets.map((a) => a.id);
  if (ids.length === 0) return [];

  return prisma.$queryRaw<
    Array<{
      symbol: string;
      price: unknown;
      change24h: unknown;
      volume24h: unknown;
      high24h: unknown;
      low24h: unknown;
      collectedAt: Date | string;
    }>
  >`
    SELECT DISTINCT ON (ms."assetId")
      a.symbol,
      ms.price,
      ms."change24h",
      ms."volume24h",
      ms."high24h",
      ms."low24h",
      ms."collectedAt"
    FROM "MarketSnapshot" ms
    JOIN "Asset" a ON a.id = ms."assetId"
    WHERE ms."assetId" = ANY(${ids}::text[])
    ORDER BY ms."assetId", ms."collectedAt" DESC
  `;
}
