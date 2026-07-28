import type { MarketDataProvider, AssetSymbol } from "@cryptoai/market-data";
import { BinanceProvider, SUPPORTED_ASSETS } from "@cryptoai/market-data";
import type { Job } from "bullmq";
import { prisma } from "@cryptoai/database";
import { logger } from "../logger.js";

export interface MarketDataCollectionJobData {
  provider?: string;
}

export interface MarketDataCollectionJobResult {
  status: "completed" | "failed";
  assetCount: number;
  candlesInserted: number;
  snapshotsInserted: number;
  error?: string;
}

/**
 * Main market data collection handler.
 */
export async function collectMarketData(
  job: Job<MarketDataCollectionJobData, MarketDataCollectionJobResult>,
): Promise<MarketDataCollectionJobResult> {
  const provider: MarketDataProvider = new BinanceProvider();
  const symbols = SUPPORTED_ASSETS.map((a) => a.symbol);

  // Create collection run record
  const run = await prisma.dataCollectionRun.create({
    data: {
      status: "RUNNING",
      provider: provider.name,
    },
  });

  let candlesInserted = 0;
  let snapshotsInserted = 0;

  try {
    // Ensure all assets exist in the database
    for (const asset of SUPPORTED_ASSETS) {
      await prisma.asset.upsert({
        where: { symbol: asset.symbol },
        update: { active: true },
        create: {
          symbol: asset.symbol,
          baseAsset: asset.baseAsset,
          quoteAsset: asset.quoteAsset,
          name: asset.name,
          active: true,
        },
      });
    }

    // Fetch 24h tickers for snapshots
    const tickers = await provider.getTickers(symbols);

    // Create snapshots
    for (const ticker of tickers) {
      const asset = await prisma.asset.findUnique({
        where: { symbol: ticker.symbol },
      });
      if (!asset) continue;

      await prisma.marketSnapshot.upsert({
        where: {
          assetId_collectedAt: {
            assetId: asset.id,
            collectedAt: new Date(),
          },
        },
        update: {
          price: ticker.price,
          change24h: ticker.changePercent24h,
          volume24h: ticker.volume24h,
          high24h: ticker.high24h,
          low24h: ticker.low24h,
          collectionRunId: run.id,
        },
        create: {
          assetId: asset.id,
          price: ticker.price,
          change24h: ticker.changePercent24h,
          volume24h: ticker.volume24h,
          high24h: ticker.high24h,
          low24h: ticker.low24h,
          collectionRunId: run.id,
        },
      });
      snapshotsInserted++;
    }

    // Fetch OHLCV candles for each asset
    for (const symbol of symbols) {
      const asset = await prisma.asset.findUnique({ where: { symbol } });
      if (!asset) continue;

      const candles = await provider.getCandles({
        symbol: symbol as AssetSymbol,
        interval: "15m",
        limit: 8, // last 2 hours
      });

      for (const candle of candles) {
        try {
          await prisma.priceCandle.upsert({
            where: {
              assetId_openTime_interval: {
                assetId: asset.id,
                openTime: new Date(candle.openTime),
                interval: "15m",
              },
            },
            update: {
              closeTime: new Date(candle.closeTime),
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              quoteVolume: candle.quoteVolume,
              trades: candle.trades,
            },
            create: {
              assetId: asset.id,
              openTime: new Date(candle.openTime),
              closeTime: new Date(candle.closeTime),
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              quoteVolume: candle.quoteVolume,
              trades: candle.trades,
              interval: "15m",
            },
          });
          candlesInserted++;
        } catch (err) {
          logger.warn(
            { err, symbol, openTime: candle.openTime },
            "Failed to upsert candle",
          );
        }
      }
    }

    // Mark collection run as completed
    await prisma.dataCollectionRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", endedAt: new Date() },
    });

    logger.info(
      {
        runId: run.id,
        assets: symbols.length,
        candlesInserted,
        snapshotsInserted,
      },
      "Market data collection completed",
    );

    return {
      status: "completed",
      assetCount: symbols.length,
      candlesInserted,
      snapshotsInserted,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, runId: run.id }, "Market data collection failed");

    await prisma.dataCollectionRun.update({
      where: { id: run.id },
      data: { status: "FAILED", endedAt: new Date(), error: message },
    });

    return {
      status: "failed",
      assetCount: symbols.length,
      candlesInserted,
      snapshotsInserted,
      error: message,
    };
  }
}
