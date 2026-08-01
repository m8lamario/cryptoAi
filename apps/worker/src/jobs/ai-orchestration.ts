import type { Job } from "bullmq";
import { prisma } from "@cryptoai/database";
import { SUPPORTED_ASSETS, BinanceProvider } from "@cryptoai/market-data";
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
import { logger } from "../logger.js";

// --- Job Types ---

export interface AIOrchestrationJobData {
  /** Override model per agent (optional) */
  models?: Partial<Record<string, string>>;
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
  const symbols = SUPPORTED_ASSETS.map((a) => a.symbol) as Array<"BTCUSDT" | "ETHUSDT" | "SOLUSDT">;
  const tickers = await provider.getTickers(symbols);
  const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));

  const results: AssetCandles[] = [];

  for (const asset of SUPPORTED_ASSETS) {
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
  logger.info("Starting AI orchestration cycle");

  let config: RunConfig;
  try {
    config = buildConfig();
  } catch (err) {
    logger.error({ err }, "Failed to build AI config");
    return {
      status: "failed",
      assetsProcessed: 0,
      agentsRun: 0,
      validReports: 0,
      proposalsGenerated: 0,
      decisionsMade: 0,
      ordersExecuted: 0,
      totalAiCostUsd: 0,
      error: err instanceof Error ? err.message : "Config error",
    };
  }

  // Init paper balance if needed
  try {
    await initPaperBalance(10000);
  } catch {
    logger.warn("Could not init paper balance (DB may not be ready)");
  }

  // Load market data
  const assets = await loadAssetData();
  if (assets.length === 0) {
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

        const managerResult = await manager.runProposal({
          ...assetContext,
          gateway: config.gateway,
          input: { symbol: assetData.symbol, reports: validReports },
        });

        // Use the REAL proposal from the Manager, not a fake one
        const proposal = managerResult.proposal;
        const managerReport = managerResult.report;

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
        } catch {
          logger.warn("Failed to persist trade proposal");
        }
        totalProposals++;

        totalAiCost += managerReport.usage.estimatedCostUsd;

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

        // Update proposal with decision gate result
        if (gateResult.decision === "APPROVE") {
          try {
            await prisma.storedTradeProposal.update({
              where: { runId: managerReport.runId },
              data: { decisionGateResult: "APPROVE" },
            });
          } catch { /* ignore */ }

          // Risk Manager
          const portfolio = await getPaperPortfolio();
          const prices: AssetPrice[] = [{
            symbol: assetData.symbol,
            price: assetData.currentPrice,
            collectedAt: new Date(),
          }];

          const portfolioSnapshot: PortfolioSnapshot = {
            totalValue: portfolio.totalValue,
            currentExposure: portfolio.totalExposure,
            assetExposure: 0,
            peakValue: portfolio.peakValue,
            dailyPnl: portfolio.dailyPnl,
          };

          const killSwitch = await prisma.killSwitch.findFirst({
            orderBy: { updatedAt: "desc" },
          });

          const riskDecision = evaluateTradeProposal(proposal, {
            riskProfile: config.riskProfile,
            portfolio: portfolioSnapshot,
            prices,
            killSwitchActive: killSwitch?.active ?? false,
            minConfidence: config.minConfidence,
            minPositionSize: config.minPositionSize,
            maxDataAgeMs: config.maxDataAgeMs,
            atrValue: indicators.atr14,
          });

          // Persist RiskDecision
          try {
            await prisma.riskDecision.create({
              data: {
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
            });

            await prisma.storedTradeProposal.update({
              where: { runId: managerReport.runId },
              data: { riskDecisionId: riskDecision.idempotencyKey },
            });
          } catch (err) {
            logger.warn({ err }, "Failed to persist risk decision");
          }
          totalDecisions++;

          // Paper Executor — only for APPROVED decisions
          if (riskDecision.status === "APPROVE" && riskDecision.positionSize) {
            try {
              // Check if we have an open LONG position for this asset (to sell)
              const openPosition = await prisma.paperPosition.findFirst({
                where: { asset: assetData.symbol, side: "LONG", status: "OPEN" },
              });

              const action = proposal.action;
              const positionQuantity = openPosition ? Number(openPosition.quantity) : 0;

              if (action === "SELL" && positionQuantity > 0) {
                // Close existing position (full close)
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

                if (execResult.status === "FILLED") {
                  totalOrders++;
                }

                logger.info(
                  {
                    symbol: assetData.symbol,
                    orderId: execResult.orderId,
                    status: execResult.status,
                    side: "SELL",
                    quantity: execResult.quantity,
                    price: execResult.price,
                    reason: execResult.reason,
                  },
                  "Paper order executed",
                );
              } else if (action === "BUY") {
                // Open new position (or add to existing)
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
                );

                if (execResult.status === "FILLED") {
                  totalOrders++;
                }

                logger.info(
                  {
                    symbol: assetData.symbol,
                    orderId: execResult.orderId,
                    status: execResult.status,
                    side: "BUY",
                    quantity: execResult.quantity,
                    price: execResult.price,
                    reason: execResult.reason,
                  },
                  "Paper order executed",
                );
              }
            } catch {
              logger.warn("Failed to execute paper order");
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
