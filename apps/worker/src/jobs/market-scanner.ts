import type { Job } from "bullmq";
import { prisma } from "@cryptoai/database";
import { SUPPORTED_ASSETS } from "@cryptoai/market-data";
import {
  scanAllAssets,
  DEFAULT_SCANNER_WEIGHTS,
} from "@cryptoai/quantitative";
import type { IndicatorInput } from "@cryptoai/quantitative";
import { storeOpportunityScore } from "@cryptoai/database";
import { logger } from "../logger.js";

// --- Job Types ---

export interface MarketScannerJobData {
  /** Override the threshold for AI trigger (optional) */
  aiTriggerThreshold?: number;
}

export interface MarketScannerJobResult {
  status: "completed" | "failed";
  assetsScanned: number;
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
 * Market Scanner Job — runs every 30-60 seconds.
 *
 * Pipeline:
 * 1. Load OHLCV candles for all supported assets
 * 2. Compute indicators (RSI, MACD, ATR, EMA, volatility)
 * 3. Score each asset 0-100 via the deterministic opportunity scanner
 * 4. Persist scores to the database
 * 5. If any asset scores >= threshold, trigger the AI orchestration
 */
export async function runMarketScanner(
  job: Job<MarketScannerJobData, MarketScannerJobResult>,
): Promise<MarketScannerJobResult> {
  void job;
  const threshold = job.data.aiTriggerThreshold ?? DEFAULT_SCANNER_WEIGHTS.aiTriggerThreshold;

  try {
    // 1. Load candles for all assets (last 100 candles = 25h of 15m data)
    const symbols = SUPPORTED_ASSETS.map((a) => a.symbol);
    const candlesByAsset = new Map<string, IndicatorInput[]>();

    for (const symbol of symbols) {
      const storedCandles = await prisma.priceCandle.findMany({
        where: {
          asset: { symbol },
          interval: "15m",
        },
        orderBy: { openTime: "asc" },
        take: 100,
      });

      const inputs: IndicatorInput[] = storedCandles.map((c) => ({
        openTime: c.openTime.getTime(),
        close: c.close.toNumber(),
        high: c.high.toNumber(),
        low: c.low.toNumber(),
        volume: c.volume.toNumber(),
      }));

      candlesByAsset.set(symbol, inputs);
    }

    // 2 & 3. Scan all assets
    const assets = SUPPORTED_ASSETS.map((a) => ({ symbol: a.symbol }));
    const results = scanAllAssets(assets, candlesByAsset);

    // 4. Persist scores
    for (const result of results) {
      try {
        await storeOpportunityScore(result);
      } catch (err) {
        logger.warn({ asset: result.asset, err }, "Failed to persist opportunity score");
      }
    }

    // 5. Check which assets trigger AI
    const triggeredAssets = results
      .filter((r) => r.score >= threshold)
      .map((r) => r.asset);

    logger.info(
      {
        threshold,
        totalAssets: results.length,
        triggered: triggeredAssets.length,
        scores: results.map((r) => `${r.asset}=${r.score}(${r.classification})`),
      },
      "Market scanner completed",
    );

    return {
      status: "completed",
      assetsScanned: results.length,
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
      scores: [],
      aiTriggered: false,
      triggeredAssets: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

