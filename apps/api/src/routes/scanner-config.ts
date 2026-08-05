import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { getScannerConfig, updateScannerConfig } from "@cryptoai/database";
import { logger } from "../logger.js";

const ScannerConfigPatchSchema = z.object({
  maxAssetsToScan: z.number().int().min(1).max(500).optional(),
  maxAssetsForQuant: z.number().int().min(1).max(100).optional(),
  maxAssetsForAI: z.number().int().min(1).max(50).optional(),
  minScoreForAI: z.number().int().min(0).max(100).optional(),
  scannerFrequencyMinutes: z.number().int().min(1).max(60).optional(),
  minVolume24hUsd: z.number().min(0).optional(),
  minMarketCapUsd: z.number().min(0).optional(),
});

export function createScannerConfigRouter(): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const config = await getScannerConfig();
      res.json(config);
    } catch (err) {
      logger.error({ err }, "Failed to get scanner config");
      res.status(500).json({ error: "Failed to get scanner configuration" });
    }
  });

  router.put("/", async (req: Request, res: Response) => {
    try {
      const parsed = ScannerConfigPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid config", details: parsed.error.issues });
        return;
      }

      const updated = await updateScannerConfig(parsed.data);
      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Failed to update scanner config");
      res.status(500).json({ error: "Failed to update scanner configuration" });
    }
  });

  return router;
}
