import type { Job } from "bullmq";
import { prisma } from "@cryptoai/database";
import { assetRegistry, fetchFuturesMetrics } from "@cryptoai/market-data";
import {
  scanAllAssets,
  DEFAULT_SCANNER_WEIGHTS,
  filterByLiquidity,
} from "@cryptoai/quantitative";
import type {
  IndicatorInput,
  LiquidityInput,
  ScannerWeights,
  AdvancedMetrics,
} from "@cryptoai/quantitative";
import { storeOpportunityScore, getScannerConfig } from "@cryptoai/database";
import { logger } from "../logger.js";
import { createConfiguredNotificationSender } from "../notifications.js";

// --- Job Types ---

export interface MarketScannerJobData {
  /** Override the threshold for AI trigger (optional) */
  aiTriggerThreshold?: number;
}

export interface MarketScannerJobResult {
  status: "completed" | "failed";
  assetsScanned: number;
  assetsFiltered: number;
  scores: Array<{
    asset: string;
    score: number;
    classification: string;
  }>;
  aiTriggered: boolean;
  triggeredAssets: string[];
  error?: string;
}

/**
 * Market Scanner Job — v1.5 M2: liquidity filter + futures metrics.
 *
 * Pipeline:
 * 1. Load 24h tickers + candles for all registered assets
 * 2. Apply liquidity filter (volume, market cap)
 * 3. Fetch futures metrics (funding rate, OI)
 * 4. Compute indicators + score each asset 0-100 (9 metrics)
 * 5. Persist scores
 * 6. Flag top assets for AI orchestration
 */
export async function runMarketScanner(
  job: Job<MarketScannerJobData, MarketScannerJobResult>,
): Promise<MarketScannerJobResult> {
  void job;
  const config = await getScannerConfig().catch(() => null);
  const threshold =
    job.data.aiTriggerThreshold ?? config?.minScoreForAI ?? DEFAULT_SCANNER_WEIGHTS.aiTriggerThreshold;

  try {
    const assets = assetRegistry.getActiveAssets();
    const symbols = assets.map((a) => a.symbol);

    // --- 1. Load tickers for liquidity filter ---
    const snapshots = await prisma.marketSnapshot.findMany({
      where: {
        asset: { symbol: { in: symbols } },
      },
      orderBy: { collectedAt: "desc" },
      distinct: ["assetId"],
      include: { asset: { select: { symbol: true } } },
    });

    const liquidityInputs: LiquidityInput[] = snapshots.map((s) => ({
      symbol: s.asset.symbol,
      volume24hUsd: s.volume24h?.toNumber() ?? 0,
      marketCapUsd: null, // not available from ticker data
      price: s.price.toNumber(),
    }));

    // --- 2. Liquidity filter ---
    const liquidSymbols = filterByLiquidity(liquidityInputs, {
      minVolume24hUsd: config?.minVolume24hUsd,
      minMarketCapUsd: config?.minMarketCapUsd,
    }).map((l) => l.symbol);
    const filteredCount = symbols.length - liquidSymbols.length;

    if (liquidSymbols.length === 0) {
      logger.info("No assets passed liquidity filter");
      return {
        status: "completed",
        assetsScanned: 0,
        assetsFiltered: filteredCount,
        scores: [],
        aiTriggered: false,
        triggeredAssets: [],
      };
    }

    // --- 3. Load candles ---
    const candlesByAsset = new Map<string, IndicatorInput[]>();
    for (const symbol of liquidSymbols) {
      const stored = await prisma.priceCandle.findMany({
        where: { asset: { symbol }, interval: "15m" },
        orderBy: { openTime: "asc" },
        take: 100,
      });
      candlesByAsset.set(
        symbol,
        stored.map((c) => ({
          openTime: c.openTime.getTime(),
          close: c.close.toNumber(),
          high: c.high.toNumber(),
          low: c.low.toNumber(),
          volume: c.volume.toNumber(),
        })),
      );
    }

    // --- 4. Fetch futures metrics (funding rate, OI) ---
    const futuresMap = await fetchFuturesMetrics(liquidSymbols);
    const advancedByAsset = new Map<string, Partial<AdvancedMetrics>>();
    for (const s of liquidSymbols) {
      const fm = futuresMap.get(s);
      advancedByAsset.set(s, {
        symbol: s,
        fundingRate: fm?.fundingRate ?? null,
        openInterest: fm?.openInterest ?? null,
        priceChange1h: null, // computed from candles
        priceChange4h: null,
        priceChange24h: null,
      });
    }

    // --- 5. Scan with advanced metrics ---
    const assetList = assets
      .filter((a) => liquidSymbols.includes(a.symbol))
      .map((a) => ({ symbol: a.symbol }));
    const results = scanAllAssets(assetList, candlesByAsset, undefined, advancedByAsset);

    // --- 6. Persist scores ---
    for (const result of results) {
      try {
        await storeOpportunityScore(result);
      } catch (err) {
        logger.warn({ asset: result.asset, err }, "Failed to persist opportunity score");
      }
    }

    // --- 7. Trigger candidates ---
    const triggeredAssets = results
      .filter((r) => r.score >= threshold)
      .map((r) => r.asset);

    // --- 7. Enqueue AI orchestration for top triggered assets (M3) ---
    const maxAiAssets = config?.maxAssetsForAI ?? 5;
    const topTriggered = triggeredAssets.slice(0, maxAiAssets);

    if (topTriggered.length > 0) {
      const { createAIOrchestrationQueue } = await import("../queues/ai-orchestration.js");
      const { getServerConfig } = await import("@cryptoai/config");
      const serverConfig = getServerConfig();
      const aiQueue = createAIOrchestrationQueue(serverConfig.REDIS_URL);

      for (const asset of topTriggered) {
        // Deduplication: job name includes asset — BullMQ deduplicates by jobId
        const jobId = `ai-orch-${asset}-${Math.floor(Date.now() / 60_000)}`;
        try {
          await aiQueue.add(jobId, { asset }, { jobId, removeOnComplete: { age: 3600 } });
          logger.info({ asset, jobId }, "Enqueued AI orchestration for triggered asset");
        } catch (err) {
          logger.warn({ asset, err }, "Failed to enqueue AI orchestration");
        }
      }
      await aiQueue.close();
    }

    // --- 8. M6: Telegram notifications for scanner events ---
    const notify = createConfiguredNotificationSender();

    // Top opportunity alert (score ≥ 80)
    const topOpportunities = results.filter((r) => r.score >= 80);
    if (topOpportunities.length > 0) {
      const top = topOpportunities[0]!;
      void notify({
        type: "OPPORTUNITY_DETECTED",
        title: `🔥 Top Opportunity: ${top.asset}`,
        message: `${top.asset} scored ${top.score}/100 (${top.classification.replace(/_/g, " ")}). ${topOpportunities.length} assets above 80.`,
        details: {
          asset: top.asset,
          score: top.score,
          classification: top.classification,
          count: topOpportunities.length,
        },
      });
    }

    // No opportunities above threshold
    if (triggeredAssets.length === 0 && results.length > 0) {
      void notify({
        type: "INFO",
        title: "📊 Scanner: No AI triggers",
        message: `Scanned ${results.length} assets. No assets scored above the AI threshold (${threshold}).`,
        details: { threshold, assetCount: results.length },
      });
    }

    logger.info(
      {
        threshold,
        totalAssets: symbols.length,
        afterLiquidity: liquidSymbols.length,
        scanned: results.length,
        triggered: triggeredAssets.length,
        scores: results.map((r) => `${r.asset}=${r.score}(${r.classification})`),
      },
      "Market scanner completed (M2)",
    );

    return {
      status: "completed",
      assetsScanned: results.length,
      assetsFiltered: filteredCount,
      scores: results.map((r) => ({
        asset: r.asset,
        score: r.score,
        classification: r.classification,
      })),
      aiTriggered: triggeredAssets.length > 0,
      triggeredAssets,
    };
  } catch (err) {
    logger.error({ err }, "Market scanner failed");
    return {
      status: "failed",
      assetsScanned: 0,
      assetsFiltered: 0,
      scores: [],
      aiTriggered: false,
      triggeredAssets: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
