import type { Job } from "bullmq";
import { prisma } from "@cryptoai/database";
import { assetRegistry, BinanceProvider } from "@cryptoai/market-data";
import { AIGateway, OpenRouterProvider } from "@cryptoai/ai-gateway";
import {
  TechnicalAgent,
  MacroAgent,
  ManagerAgent,
  AgentOrchestrator,
} from "@cryptoai/agents";
import type { AgentReport } from "@cryptoai/agents";
import {
  sma,
  ema,
  rsi,
  macd,
  atr,
  volatility,
  latestValue,
} from "@cryptoai/quantitative";
import {
  evaluateDecisionGate,
  evaluateTradeProposal,
} from "@cryptoai/risk-engine";
import type {
  DecisionGateReport,
  DecisionGateConfig,
  RiskProfileConfig,
  PortfolioSnapshot,
  AssetPrice,
} from "@cryptoai/risk-engine";
import {
  initPaperBalance,
  executePaperBuy,
  executePaperSell,
  markToMarket,
  getPaperPortfolio,
} from "@cryptoai/paper-executor";
import { storeAgentReport, storeTradeProposal } from "@cryptoai/database";
import {
  hashConfigurationPayload,
  upsertConfigurationSnapshot,
  upsertDecisionAudit,
} from "@cryptoai/database";
import { logger } from "../logger.js";
import {
  createConfiguredNotificationSender,
  isBudgetExhaustedReason,
} from "../notifications.js";

// --- Job Types ---

export interface AIOrchestrationJobData {
  /** Override model per agent (optional) */
  models?: Partial<Record<string, string>>;
  /** M3: process a single asset only. When absent, processes all registered assets. */
  asset?: string;
}

export interface AIOrchestrationJobResult {
  status: "completed" | "partial" | "failed";
  assetsProcessed: number;
  agentsRun: number;
  validReports: number;
  proposalsGenerated: number;
  decisionsMade: number;
  ordersExecuted: number;
  totalAiCostUsd: number;
  error?: string;
}

// --- Config ---

interface RunConfig {
  gateway: AIGateway;
  decisionGateConfig: DecisionGateConfig;
  riskProfile: RiskProfileConfig;
  commissionRate: number;
  slippagePercent: number;
  minPositionSize: number;
  maxDataAgeMs: number;
  minConfidence: number;
}

function readEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function parseFloatEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return Number.parseFloat(v);
}

function buildConfig(): RunConfig {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("OPENROUTER_API_KEY is required for AI orchestration");
  }

  const provider = new OpenRouterProvider({
    apiKey,
    baseUrl: process.env["OPENROUTER_BASE_URL"] ?? undefined,
    appTitle: process.env["OPENROUTER_APP_TITLE"] ?? "cryptoai",
    httpReferer: process.env["OPENROUTER_HTTP_REFERER"] ?? undefined,
    defaultModel: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "deepseek/deepseek-v4-flash",
  });

  const gateway = new AIGateway({
    provider,
    budget: {
      maxDailyUsd: parseFloatEnv("AI_DAILY_BUDGET_USD", 1.0),
      maxMonthlyUsd: parseFloatEnv("AI_MONTHLY_BUDGET_USD", 20.0),
    },
    circuitBreaker: {
      failureThreshold: Number.parseInt(readEnv("AI_CIRCUIT_FAILURE_THRESHOLD", "5"), 10),
      resetTimeoutMs: Number.parseInt(readEnv("AI_CIRCUIT_RESET_TIMEOUT_MS", "60000"), 10),
      halfOpenMaxCalls: Number.parseInt(readEnv("AI_CIRCUIT_HALF_OPEN_MAX_CALLS", "1"), 10),
    },
    defaultTimeoutMs: Number.parseInt(readEnv("AI_DEFAULT_TIMEOUT_MS", "60000"), 10),
    defaultMaxRetries: Number.parseInt(readEnv("AI_DEFAULT_MAX_RETRIES", "2"), 10),
    defaultTemperature: parseFloatEnv("AI_DEFAULT_TEMPERATURE", 0.3),
    defaultMaxTokens: Number.parseInt(readEnv("AI_DEFAULT_MAX_TOKENS", "1500"), 10),
  });

  return {
    gateway,
    decisionGateConfig: {
      minValidReports: 2,
      minConfidence: 0.5,
      maxProposalAgeMs: 3600_000,
      maxReportAgeMs: 7200_000,
    },
    riskProfile: {
      maxPortfolioExposurePercent: 50,
      maxAssetExposurePercent: 30,
      maxDailyLossPercent: 5,
      maxDrawdownPercent: 20,
    },
    commissionRate: 0.001,
    slippagePercent: 0.05,
    minPositionSize: 0.0001,
    maxDataAgeMs: 30 * 60_000,
    minConfidence: 0.5,
  };
}

// --- Data Loading ---

interface AssetCandles {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  candles: Array<{
    openTime: number;
    closeTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  currentPrice: number;
  change24h: number | null;
}

async function loadAssetData(): Promise<AssetCandles[]> {
  const provider = new BinanceProvider();
  const activeAssets = assetRegistry.getActiveAssets();
  const symbols = activeAssets.map((a) => a.symbol);
  const tickers = await provider.getTickers(symbols);
  const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));

  const results: AssetCandles[] = [];

  for (const asset of activeAssets) {
    try {
      const rawCandles = await provider.getCandles({
        symbol: asset.symbol,
        interval: "15m",
        limit: 60, // last 15 hours for indicators
      });

      const ticker = tickerMap.get(asset.symbol);
      const candles = rawCandles.map((c) => ({
        openTime: c.openTime,
        closeTime: c.closeTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      results.push({
        symbol: asset.symbol,
        baseAsset: asset.baseAsset,
        quoteAsset: asset.quoteAsset,
        candles,
        currentPrice: ticker?.price ?? candles[candles.length - 1]?.close ?? 0,
        change24h: ticker?.changePercent24h ?? null,
      });
    } catch {
      logger.warn("Failed to load data for asset");
    }
  }

  return results;
}

// --- Indicator Computation ---

function computeIndicators(candles: AssetCandles["candles"]) {
  const indicatorInputs = candles.map((c) => ({
    openTime: c.openTime,
    close: c.close,
    high: c.high,
    low: c.low,
    volume: c.volume,
  }));

  const sma20Arr = sma(indicatorInputs, 20);
  const sma50Arr = sma(indicatorInputs, 50);
  const ema20Arr = ema(indicatorInputs, 20);
  const rsiArr = rsi(indicatorInputs, 14);
  const macdResult = macd(indicatorInputs);
  const atrArr = atr(indicatorInputs, 14);
  const volArr = volatility(indicatorInputs, 20);

  return {
    sma20: latestValue(sma20Arr),
    sma50: latestValue(sma50Arr),
    ema20: latestValue(ema20Arr),
    rsi14: latestValue(rsiArr),
    macd: latestValue(macdResult.macd),
    macdSignal: latestValue(macdResult.signal),
    macdHistogram: latestValue(macdResult.histogram),
    atr14: latestValue(atrArr),
    volatility: latestValue(volArr),
  };
}

// --- Main Handler ---

export async function runAIOrchestration(
  job: Job<AIOrchestrationJobData, AIOrchestrationJobResult>,
): Promise<AIOrchestrationJobResult> {
  void job;
  const startTime = Date.now();
  const notify = createConfiguredNotificationSender();
  let budgetNotificationSent = false;
  logger.info("Starting AI orchestration cycle");

  let config: RunConfig;
  let configurationBundle: M0ConfigurationBundle;
  try {
    config = buildConfig();
    configurationBundle = await createM0ConfigurationBundle(config, job.data.models);
    logger.info({ snapshotCount: configurationBundle.ids.length, migrationSafe: configurationBundle.migrationSafe }, "M0 configuration bundle ready");
  } catch (err) {
    logger.error({ err }, "Failed to build AI config or M0 configuration bundle");
    return {
      status: "failed",
      assetsProcessed: 0,
      agentsRun: 0,
      validReports: 0,
      proposalsGenerated: 0,
      decisionsMade: 0,
      ordersExecuted: 0,
      totalAiCostUsd: 0,
      error: "M0 configuration snapshot unavailable",
    };
  }

  // Init paper balance if needed
  try {
    await initPaperBalance(10000);
  } catch (err) {
    logger.error({ err }, "Paper balance initialization failed; skipping orchestration");
    return {
      status: "failed",
      assetsProcessed: 0,
      agentsRun: 0,
      validReports: 0,
      proposalsGenerated: 0,
      decisionsMade: 0,
      ordersExecuted: 0,
      totalAiCostUsd: 0,
      error: "Paper balance is not available",
    };
  }

  // Load market data — M3: filter by asset if specified
  const allAssets = await loadAssetData();
  const assets = job.data.asset
    ? allAssets.filter((a) => a.symbol === job.data.asset)
    : allAssets;

  if (job.data.asset) {
    logger.info({ asset: job.data.asset, mode: "single-asset" }, "AI orchestration (M3 targeted)");
  }

  if (assets.length === 0) {
    void notify({
      type: "DATA_STALE",
      title: "Market Data Unavailable",
      message: "No asset data was loaded; the orchestration cycle was skipped.",
      details: { timestamp: new Date().toISOString() },
    });
    return {
      status: "failed",
      assetsProcessed: 0,
      agentsRun: 0,
      validReports: 0,
      proposalsGenerated: 0,
      decisionsMade: 0,
      ordersExecuted: 0,
      totalAiCostUsd: 0,
      error: "No asset data loaded",
    };
  }

  let totalAgentsRun = 0;
  let totalValidReports = 0;
  let totalProposals = 0;
  let totalDecisions = 0;
  let totalOrders = 0;
  let totalAiCost = 0;

  // Process each asset
  for (const assetData of assets) {
    logger.info({ symbol: assetData.symbol }, "Processing asset");

    try {
      // Compute indicators
      const indicators = computeIndicators(assetData.candles);
      const recentCandles = assetData.candles.slice(-8).map((c) => ({
        openTime: new Date(c.openTime).toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      // Build agent inputs
      const agents = [
        new TechnicalAgent({ model: job.data.models?.["technical-agent"] }),
        new MacroAgent({ model: job.data.models?.["macro-agent"] }),
        // News/Sentiment/Whale have no live data sources yet — skip or mock
      ];

      const orchestrator = new AgentOrchestrator({ gateway: config.gateway, agents });

      const assetContext = {
        asset: assetData.baseAsset,
        symbol: assetData.symbol,
        baseAsset: assetData.baseAsset,
        quoteAsset: assetData.quoteAsset,
      };

      const results = await orchestrator.runAll(assetContext, {
        "technical-agent": {
          symbol: assetData.symbol,
          price: assetData.currentPrice,
          change24h: assetData.change24h,
          sma20: indicators.sma20,
          sma50: indicators.sma50,
          ema20: indicators.ema20,
          rsi14: indicators.rsi14,
          macd: indicators.macd,
          macdSignal: indicators.macdSignal,
          macdHistogram: indicators.macdHistogram,
          atr14: indicators.atr14,
          volatility: indicators.volatility,
          recentCandles,
        },
        "macro-agent": {
          symbol: assetData.symbol,
          price: assetData.currentPrice,
          change24h: assetData.change24h,
          volatility: indicators.volatility,
          btcDominance: null,
          fearGreedIndex: null,
          totalMarketCap: null,
          sp500Change24h: null,
          dxy: null,
          fedFundsRate: null,
        },
      });

      if (
        !budgetNotificationSent &&
        results.some((result) => result.report.reasoning.some(isBudgetExhaustedReason))
      ) {
        budgetNotificationSent = true;
        void notify({
          type: "AI_BUDGET_EXHAUSTED",
          title: "AI Budget Exhausted",
          message: "One or more AI calls were unavailable because the configured budget was exhausted.",
          details: { asset: assetData.symbol },
        });
      }

      // Persist agent reports
      const validReports: AgentReport[] = [];
      for (const r of results) {
        totalAgentsRun++;
        const report = r.report;
        try {
          await storeAgentReport({
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
            promptTokens: report.usage.promptTokens,
            completionTokens: report.usage.completionTokens,
            latencyMs: report.usage.latencyMs,
            estimatedCostUsd: report.usage.estimatedCostUsd,
            status: report.status,
          });
        } catch {
          logger.warn("Failed to persist agent report");
        }

        totalAiCost += report.usage.estimatedCostUsd;

        if (report.status === "VALID") {
          validReports.push(report);
          totalValidReports++;
        }
      }

      // Run ManagerAgent if we have valid reports
      if (validReports.length >= config.decisionGateConfig.minValidReports) {
        const manager = new ManagerAgent({
          model: job.data.models?.["manager-agent"],
          minValidReports: config.decisionGateConfig.minValidReports,
        });

        // Fetch open position for this asset (for portfolio-aware decisions)
        let openPositions: Array<{
          side: string;
          quantity: number;
          entryPrice: number;
          currentPrice: number;
          unrealizedPnl: number;
        }> = [];
        try {
          const pos = await prisma.paperPosition.findFirst({
            where: { asset: assetData.symbol, side: "LONG", status: "OPEN" },
          });
          if (pos) {
            openPositions = [{
              side: pos.side,
              quantity: Number(pos.quantity),
              entryPrice: Number(pos.entryPrice),
              currentPrice: Number(pos.currentPrice),
              unrealizedPnl: Number(pos.unrealizedPnl),
            }];
          }
        } catch {
          // DB may not be ready — no big deal
        }

        const managerResult = await manager.runProposal({
          ...assetContext,
          gateway: config.gateway,
          input: { symbol: assetData.symbol, reports: validReports, openPositions },
        });

        // Use the REAL proposal from the Manager, not a fake one
        const proposal = managerResult.proposal;
        const managerReport = managerResult.report;

        if (!budgetNotificationSent && managerReport.reasoning.some(isBudgetExhaustedReason)) {
          budgetNotificationSent = true;
          void notify({
            type: "AI_BUDGET_EXHAUSTED",
            title: "AI Budget Exhausted",
            message: "The manager proposal was unavailable because the configured budget was exhausted.",
            details: { asset: assetData.symbol, agent: managerReport.agentId },
          });
        }

        // Persist Manager's own AgentReport for audit trail
        try {
          await storeAgentReport({
            runId: managerReport.runId,
            agentId: managerReport.agentId,
            agentVersion: managerReport.agentVersion,
            promptVersion: managerReport.promptVersion,
            requestedModel: managerReport.requestedModel,
            actualModel: managerReport.actualModel,
            asset: managerReport.asset,
            horizon: managerReport.horizon,
            signal: managerReport.signal,
            score: managerReport.score,
            confidence: managerReport.confidence,
            dataQuality: managerReport.dataQuality,
            reasoning: managerReport.reasoning,
            supportingEvidence: managerReport.supportingEvidence,
            opposingEvidence: managerReport.opposingEvidence,
            sourceIds: managerReport.sourceIds,
            promptTokens: managerReport.usage.promptTokens,
            completionTokens: managerReport.usage.completionTokens,
            latencyMs: managerReport.usage.latencyMs,
            estimatedCostUsd: managerReport.usage.estimatedCostUsd,
            status: managerReport.status,
          });
        } catch {
          logger.warn("Failed to persist manager agent report");
        }

        // Persist proposal
        let proposalPersisted = false;
        try {
          await storeTradeProposal({
            runId: managerReport.runId,
            asset: proposal.asset,
            action: proposal.action,
            confidence: proposal.confidence,
            suggestedRiskFraction: proposal.suggestedRiskFraction,
            rationale: proposal.rationale,
            reportIds: proposal.reportIds,
            invalidationConditions: proposal.invalidationConditions,
            expiresAt: proposal.expiresAt ? new Date(proposal.expiresAt) : null,
            status: proposal.status,
            decisionGateResult: null,
            riskDecisionId: null,
            managerAgentVersion: manager.agentVersion,
            managerPromptVersion: manager.promptVersion,
            requestedModel: managerReport.requestedModel,
            actualModel: managerReport.actualModel,
            promptTokens: managerReport.usage.promptTokens,
            completionTokens: managerReport.usage.completionTokens,
            latencyMs: managerReport.usage.latencyMs,
            estimatedCostUsd: managerReport.usage.estimatedCostUsd,
          });
          proposalPersisted = true;
        } catch (err) {
          logger.error({ err, asset: assetData.symbol }, "Failed to persist trade proposal; skipping execution");
        }
        if (!proposalPersisted) continue;

        totalProposals++;

        totalAiCost += managerReport.usage.estimatedCostUsd;

        if (proposal.status === "AMBIGUOUS") {
          void notify({
            type: "APPROVAL_REQUIRED",
            title: "Ambiguous Proposal Requires Review",
            message: "The Investment Manager detected conflicting evidence and vetoed automatic action.",
            details: {
              asset: proposal.asset,
              confidence: proposal.confidence,
              reportCount: proposal.reportIds.length,
            },
          });
        }

        // Decision Gate
        const dgReports: DecisionGateReport[] = validReports.map((r) => ({
          status: r.status,
          runId: r.runId,
          agentId: r.agentId,
          signal: r.signal,
          score: r.score,
          confidence: r.confidence,
          dataQuality: r.dataQuality,
          reasoning: r.reasoning,
          generatedAt: r.generatedAt,
        }));

        const gateResult = evaluateDecisionGate(proposal, dgReports, config.decisionGateConfig);
        try {
          await upsertDecisionAudit({
            decisionKey: managerReport.runId,
            proposalRunId: managerReport.runId,
            asset: assetData.symbol,
            action: proposal.action,
            decisionStatus: gateResult.decision,
            marketInput: {
              symbol: assetData.symbol,
              price: assetData.currentPrice,
              change24h: assetData.change24h,
              recentCandles,
            },
            quantitativeFeatures: indicators,
            agentReportIds: results.map((result) => result.report.runId),
            proposalJson: proposal as unknown as Record<string, unknown>,
            decisionGateResult: gateResult.decision,
            riskDecisionId: null,
            orderId: null,
            configurationSnapshotIds: configurationBundle.ids,
            promptVersion: managerReport.promptVersion,
            requestedModel: managerReport.requestedModel,
            actualModel: managerReport.actualModel,
            outcomeStatus: gateResult.decision === "APPROVE" ? "PENDING" : "NO_ACTION",
            migrationSafe: configurationBundle.migrationSafe,
          });
        } catch (err) {
          logger.error({ err, asset: assetData.symbol }, "Failed to persist decision audit; skipping execution");
          continue;
        }

        if (gateResult.decision === "APPROVE") {
          const portfolio = await getPaperPortfolio();
          const prices: AssetPrice[] = [{
            symbol: assetData.symbol,
            price: assetData.currentPrice,
            collectedAt: new Date(),
          }];
          const portfolioSnapshot: PortfolioSnapshot = {
            totalValue: portfolio.totalValue,
            currentExposure: portfolio.totalExposure,
            assetExposure: portfolio.positions
              .filter((position) => position.asset === assetData.symbol && position.side === "LONG")
              .reduce((exposure, position) => exposure + position.quantity * position.currentPrice, 0),
            peakValue: portfolio.peakValue,
            dailyPnl: portfolio.dailyPnl,
          };
          const killSwitch = await prisma.killSwitch.findFirst({ orderBy: { updatedAt: "desc" } });
          const riskDecision = evaluateTradeProposal(proposal, {
            riskProfile: config.riskProfile,
            portfolio: portfolioSnapshot,
            prices,
            killSwitchActive: killSwitch?.active ?? false,
            minConfidence: config.minConfidence,
            minPositionSize: config.minPositionSize,
            maxDataAgeMs: config.maxDataAgeMs,
            atrValue: indicators.atr14,
            proposalRunId: managerReport.runId,
          });

          const persistedRiskDecision = await prisma.riskDecision.upsert({
            where: { idempotencyKey: riskDecision.idempotencyKey },
            create: {
              status: riskDecision.status,
              ruleCode: riskDecision.ruleCode,
              reason: riskDecision.reason,
              proposalJson: JSON.parse(JSON.stringify(proposal)),
              observedValue: riskDecision.observedValue,
              configuredLimit: riskDecision.configuredLimit,
              positionSize: riskDecision.positionSize,
              stopLoss: riskDecision.stopLoss,
              idempotencyKey: riskDecision.idempotencyKey,
              asset: assetData.symbol,
            },
            update: {},
          });
          await prisma.storedTradeProposal.update({
            where: { runId: managerReport.runId },
            data: { decisionGateResult: "APPROVE", riskDecisionId: persistedRiskDecision.id },
          });
          await upsertDecisionAudit({
            decisionKey: managerReport.runId,
            proposalRunId: managerReport.runId,
            asset: assetData.symbol,
            action: proposal.action,
            decisionStatus: riskDecision.status,
            marketInput: {
              symbol: assetData.symbol,
              price: assetData.currentPrice,
              change24h: assetData.change24h,
              recentCandles,
            },
            quantitativeFeatures: {
              ...indicators,
              portfolio: portfolioSnapshot,
              riskRule: riskDecision.ruleCode,
            },
            agentReportIds: results.map((result) => result.report.runId),
            proposalJson: proposal as unknown as Record<string, unknown>,
            decisionGateResult: gateResult.decision,
            riskDecisionId: persistedRiskDecision.id,
            configurationSnapshotIds: configurationBundle.ids,
            promptVersion: managerReport.promptVersion,
            requestedModel: managerReport.requestedModel,
            actualModel: managerReport.actualModel,
            outcomeStatus: riskDecision.status === "APPROVE" ? "PENDING" : "BLOCKED",
            migrationSafe: configurationBundle.migrationSafe,
          });
          totalDecisions++;

          if (riskDecision.status === "BLOCK") {
            void notify({
              type: "PROPOSAL_BLOCKED",
              title: "Proposal Blocked by Risk Manager",
              message: riskDecision.reason,
              details: { asset: assetData.symbol, ruleCode: riskDecision.ruleCode },
            });
          }

          if (riskDecision.status === "APPROVE" && riskDecision.positionSize) {
            try {
              const openPosition = await prisma.paperPosition.findFirst({
                where: { asset: assetData.symbol, side: "LONG", status: "OPEN" },
              });
              const positionQuantity = openPosition ? Number(openPosition.quantity) : 0;
              const action = proposal.action;

              if (action === "SELL" && positionQuantity > 0) {
                const execResult = await executePaperSell(
                  assetData.symbol,
                  positionQuantity,
                  assetData.currentPrice,
                  {
                    initialBalance: 10000,
                    commissionRate: config.commissionRate,
                    slippagePercent: config.slippagePercent,
                    minPositionSize: config.minPositionSize,
                  },
                  managerReport.runId,
                  riskDecision.idempotencyKey,
                );
                if (execResult.status === "FILLED") totalOrders++;
              } else if (action === "BUY") {
                const execResult = await executePaperBuy(
                  assetData.symbol,
                  riskDecision.positionSize,
                  assetData.currentPrice,
                  {
                    initialBalance: 10000,
                    commissionRate: config.commissionRate,
                    slippagePercent: config.slippagePercent,
                    minPositionSize: config.minPositionSize,
                  },
                  managerReport.runId,
                  riskDecision.idempotencyKey,
                  { stopLoss: riskDecision.stopLoss },
                );
                if (execResult.status === "FILLED") totalOrders++;
              }
            } catch (err) {
              logger.warn({ err, asset: assetData.symbol }, "Failed to execute paper order");
            }
          }
        }
      }
    } catch {
      logger.error("Failed to process asset");
    }
  }

  // Mark-to-market all open positions
  try {
    const priceUpdates = assets.map((a) => ({
      asset: a.symbol,
      price: a.currentPrice,
    }));
    await markToMarket(priceUpdates);
  } catch {
    logger.warn("Failed to mark-to-market");
  }

  const elapsed = (Date.now() - startTime) / 1000;
  logger.info(
    {
      elapsed: `${elapsed.toFixed(1)}s`,
      assetsProcessed: assets.length,
      agentsRun: totalAgentsRun,
      validReports: totalValidReports,
      proposalsGenerated: totalProposals,
      decisionsMade: totalDecisions,
      ordersExecuted: totalOrders,
      totalAiCostUsd: totalAiCost.toFixed(6),
    },
    "AI orchestration cycle completed",
  );

  return {
    status: "completed",
    assetsProcessed: assets.length,
    agentsRun: totalAgentsRun,
    validReports: totalValidReports,
    proposalsGenerated: totalProposals,
    decisionsMade: totalDecisions,
    ordersExecuted: totalOrders,
    totalAiCostUsd: Math.round(totalAiCost * 1_000_000) / 1_000_000,
  };
}

interface M0ConfigurationBundle {
  ids: string[];
  migrationSafe: boolean;
}

async function createM0ConfigurationBundle(
  config: RunConfig,
  modelOverrides?: Partial<Record<string, string>>,
): Promise<M0ConfigurationBundle> {
  const scanner = await prisma.scannerConfig.findFirst({ orderBy: { updatedAt: "desc" } });
  const risk = config.riskProfile;
  const feePayload = {
    commissionRate: config.commissionRate,
    slippagePercent: config.slippagePercent,
    minPositionSize: config.minPositionSize,
  };
  const aiPayload = {
    requestedModels: modelOverrides ?? {},
    defaultModel: process.env["OPENROUTER_DEFAULT_MODEL"] ?? "deepseek/deepseek-v4-flash",
    dailyBudgetUsd: parseFloatEnv("AI_DAILY_BUDGET_USD", 1.0),
    monthlyBudgetUsd: parseFloatEnv("AI_MONTHLY_BUDGET_USD", 20.0),
    defaultTemperature: parseFloatEnv("AI_DEFAULT_TEMPERATURE", 0.3),
    defaultMaxTokens: Number.parseInt(readEnv("AI_DEFAULT_MAX_TOKENS", "1500"), 10),
    timeoutMs: Number.parseInt(readEnv("AI_DEFAULT_TIMEOUT_MS", "60000"), 10),
    maxRetries: Number.parseInt(readEnv("AI_DEFAULT_MAX_RETRIES", "2"), 10),
  };
  const snapshots = await Promise.all([
    upsertConfigurationSnapshot({
      kind: "SCANNER",
      version: `scanner-${scanner?.updatedAt.toISOString() ?? "defaults"}`,
      payload: scanner ? {
        maxAssetsToScan: scanner.maxAssetsToScan,
        maxAssetsForQuant: scanner.maxAssetsForQuant,
        maxAssetsForAI: scanner.maxAssetsForAI,
        minScoreForAI: scanner.minScoreForAI,
        scannerFrequencyMinutes: scanner.scannerFrequencyMinutes,
        minVolume24hUsd: Number(scanner.minVolume24hUsd),
        minMarketCapUsd: Number(scanner.minMarketCapUsd),
      } : { source: "runtime-defaults" },
    }),
    upsertConfigurationSnapshot({
      kind: "RISK",
      version: `runtime-risk-${hashConfigurationPayload(risk as unknown as Record<string, unknown>).slice(0, 16)}`,
      payload: risk as unknown as Record<string, unknown>,
    }),
    upsertConfigurationSnapshot({
      kind: "AI",
      version: `runtime-ai-${hashConfigurationPayload(aiPayload).slice(0, 16)}`,
      payload: aiPayload,
    }),
    upsertConfigurationSnapshot({
      kind: "FEE",
      version: `runtime-fee-${hashConfigurationPayload(feePayload).slice(0, 16)}`,
      payload: feePayload,
    }),
    upsertConfigurationSnapshot({
      kind: "EXECUTION",
      version: "paper-execution-v1",
      payload: { initialBalance: 10000, migrationSafe: true },
    }),
    upsertConfigurationSnapshot({
      kind: "SYSTEM",
      version: "migration-safe-v1",
      payload: { mode: "PAPER", migrationSafe: true, tradingReal: false },
    }),
  ]);
  return { ids: snapshots.map((snapshot) => snapshot.id), migrationSafe: true };
}
