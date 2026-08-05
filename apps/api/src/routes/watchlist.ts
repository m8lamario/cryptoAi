import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { getActiveAssets, getAssetConfig, setAssetConfig } from "@cryptoai/database";
import { logger } from "../logger.js";

const AssetPatchSchema = z.object({
  isPinned: z.boolean().optional(),
  isExcluded: z.boolean().optional(),
  maxCapitalUsd: z.number().min(0).nullable().optional(),
});

export function createWatchlistRouter(): Router {
  const router = Router();

  /**
   * GET /watchlist
   * Returns all configured assets with their pin/exclude/capital settings.
   */
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const assets = await getActiveAssets();
      res.json({ assets, count: assets.length });
    } catch (err) {
      logger.error({ err }, "Failed to get watchlist");
      res.status(500).json({ error: "Failed to get watchlist" });
    }
  });

  /**
   * GET /watchlist/assets/:asset
   * Returns config for a single asset.
   */
  router.get("/assets/:asset", async (req: Request, res: Response) => {
    try {
      const config = await getAssetConfig(String(req.params.asset).toUpperCase());
      if (!config) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }
      res.json(config);
    } catch (err) {
      logger.error({ err }, "Failed to get asset config");
      res.status(500).json({ error: "Failed to get asset config" });
    }
  });

  /**
   * PUT /watchlist/assets/:asset
   * Updates pin/exclude/capital settings for a single asset.
   */
  router.put("/assets/:asset", async (req: Request, res: Response) => {
    try {
      const symbol = String(req.params.asset).toUpperCase();
      const parsed = AssetPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid asset config", details: parsed.error.issues });
        return;
      }

      const updated = await setAssetConfig(symbol, parsed.data);
      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Failed to update asset config");
      res.status(500).json({ error: "Failed to update asset config" });
    }
  });

  return router;
}
