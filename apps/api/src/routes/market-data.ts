import { Router } from "express";
import { prisma } from "@cryptoai/database";
import { AssetSymbolSchema } from "@cryptoai/market-data";
import type {
  LatestResponse,
  HistoryResponse,
  CollectionStatusResponse,
} from "@cryptoai/contracts";
import { logger } from "../logger.js";

export const MARKET_DATA_ROUTE = "/market-data";

export function createMarketDataRouter(): Router {
  const router = Router();

  /**
   * GET /market-data/latest
   * Returns the most recent snapshots for all active assets.
   */
  router.get("/latest", async (_req, res) => {
    try {
      const assets = await prisma.asset.findMany({
        where: { active: true },
        select: { id: true, symbol: true },
      });

      if (assets.length === 0) {
        const response: LatestResponse = { snapshots: [], collectedAt: new Date().toISOString() };
        res.json(response);
        return;
      }

      const assetIds = assets.map((a) => a.id);

      // Get latest snapshot for each asset using a raw query
      const snapshots = await prisma.$queryRaw<
        {
          id: string;
          assetId: string;
          symbol: string;
          price: string;
          change24h: string | null;
          volume24h: string | null;
          high24h: string | null;
          low24h: string | null;
          collectedAt: Date;
        }[]
      >`
        SELECT DISTINCT ON (ms."assetId")
          ms.id,
          ms."assetId",
          a.symbol,
          ms.price::text,
          ms."change24h"::text,
          ms."volume24h"::text,
          ms."high24h"::text,
          ms."low24h"::text,
          ms."collectedAt"
        FROM "MarketSnapshot" ms
        JOIN "Asset" a ON a.id = ms."assetId"
        WHERE ms."assetId" = ANY(${assetIds}::text[])
        ORDER BY ms."assetId", ms."collectedAt" DESC
      `;

      const firstSnapshot = snapshots[0];
      const collectedAt =
        firstSnapshot
          ? firstSnapshot.collectedAt.toISOString()
          : new Date().toISOString();

      const response: LatestResponse = {
        snapshots: snapshots.map((s) => ({
          symbol: s.symbol,
          price: Number.parseFloat(s.price),
          change24h: s.change24h ? Number.parseFloat(s.change24h) : null,
          volume24h: s.volume24h ? Number.parseFloat(s.volume24h) : null,
          high24h: s.high24h ? Number.parseFloat(s.high24h) : null,
          low24h: s.low24h ? Number.parseFloat(s.low24h) : null,
          collectedAt: s.collectedAt.toISOString(),
        })),
        collectedAt,
      };

      res.json(response);
    } catch (err) {
      logger.error({ err }, "Failed to fetch latest market data");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /market-data/history?symbol=BTCUSDT&interval=15m&limit=100
   * Returns historical OHLCV candles for a given symbol.
   */
  router.get("/history", async (req, res) => {
    try {
      const symbolResult = AssetSymbolSchema.safeParse(req.query.symbol);
      if (!symbolResult.success) {
        res.status(400).json({
          error: "Invalid symbol. Must be a registered trading pair (e.g. BTCUSDT, ETHUSDT).",
        });
        return;
      }

      const symbol = symbolResult.data;
      const interval = (req.query.interval as string) ?? "15m";
      const limit = Math.min(
        Number.parseInt(req.query.limit as string, 10) || 100,
        500,
      );

      const asset = await prisma.asset.findUnique({
        where: { symbol },
      });

      if (!asset) {
        const response: HistoryResponse = {
          symbol,
          interval,
          candles: [],
          count: 0,
        };
        res.json(response);
        return;
      }

      const candles = await prisma.priceCandle.findMany({
        where: { assetId: asset.id, interval },
        orderBy: { openTime: "asc" },
        take: limit,
      });

      const response: HistoryResponse = {
        symbol,
        interval,
        candles: candles.map((c) => ({
          symbol: asset.symbol,
          openTime: c.openTime.toISOString(),
          closeTime: c.closeTime.toISOString(),
          open: Number.parseFloat(c.open.toString()),
          high: Number.parseFloat(c.high.toString()),
          low: Number.parseFloat(c.low.toString()),
          close: Number.parseFloat(c.close.toString()),
          volume: Number.parseFloat(c.volume.toString()),
          quoteVolume: Number.parseFloat(c.quoteVolume.toString()),
          trades: c.trades,
          interval: c.interval,
        })),
        count: candles.length,
      };

      res.json(response);
    } catch (err) {
      logger.error({ err }, "Failed to fetch market data history");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /market-data/collection-status
   * Returns the status of the last data collection run.
   */
  router.get("/collection-status", async (_req, res) => {
    try {
      const lastRun = await prisma.dataCollectionRun.findFirst({
        orderBy: { startedAt: "desc" },
      });

      const assetCount = await prisma.asset.count({ where: { active: true } });

      const response: CollectionStatusResponse = {
        lastRun: lastRun
          ? {
              id: lastRun.id,
              startedAt: lastRun.startedAt.toISOString(),
              endedAt: lastRun.endedAt?.toISOString() ?? null,
              status: lastRun.status,
              provider: lastRun.provider,
              error: lastRun.error,
            }
          : null,
        assetCount,
      };

      res.json(response);
    } catch (err) {
      logger.error({ err }, "Failed to fetch collection status");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
