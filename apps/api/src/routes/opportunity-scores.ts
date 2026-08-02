import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@cryptoai/database";
import { logger } from "../logger.js";

export const OPPORTUNITY_SCORES_ROUTE = "/opportunity-scores";

export function createOpportunityScoresRouter(): Router {
  const router = Router();

  /**
   * GET /opportunity-scores
   * Returns the latest opportunity score for each asset, sorted by score descending.
   * Query params: limit (default 50), minScore, classification
   */
  router.get("/", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(
        Number.parseInt(req.query.limit as string, 10) || 50,
        200,
      );
      const minScore = req.query.minScore
        ? Number.parseInt(req.query.minScore as string, 10)
        : undefined;
      const classification = req.query.classification as string | undefined;

      const raw = await prisma.$queryRawUnsafe<
        Array<{
          asset: string;
          score: number;
          classification: string;
          components: unknown;
          evaluated_at: Date;
        }>
      >(
        `SELECT DISTINCT ON (asset)
           asset, score, classification, components, evaluated_at
         FROM "MarketOpportunityScore"
         WHERE 1=1
           ${minScore !== undefined ? `AND score >= ${minScore}` : ""}
           ${classification ? `AND classification = '${classification}'` : ""}
         ORDER BY asset, evaluated_at DESC`,
      );

      // Sort by score descending and apply limit in application layer
      const sorted = raw
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => ({
          asset: r.asset,
          score: r.score,
          classification: r.classification,
          components: JSON.parse(JSON.stringify(r.components)),
          evaluatedAt: r.evaluated_at.toISOString(),
        }));

      res.json({ scores: sorted, count: sorted.length });
    } catch (err) {
      logger.error({ err }, "Failed to get opportunity scores");
      res.status(500).json({ error: "Failed to get opportunity scores" });
    }
  });

  /**
   * GET /opportunity-scores/:asset
   * Returns historical opportunity scores for a single asset.
   * Query params: limit (default 100), hours (default 24)
   */
  router.get("/:asset", async (req: Request, res: Response) => {
    try {
      const { asset } = req.params;
      const symbol = String(asset).toUpperCase();
      const limit = Math.min(
        Number.parseInt(req.query.limit as string, 10) || 100,
        500,
      );
      const hours = Number.parseInt(req.query.hours as string, 10) || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const rows = await prisma.marketOpportunityScore.findMany({
        where: {
          asset: symbol,
          evaluatedAt: { gte: since },
        },
        orderBy: { evaluatedAt: "desc" },
        take: limit,
      });

      res.json({
        asset: symbol,
        history: rows.map((r) => ({
          score: r.score,
          classification: r.classification,
          components: r.components,
          evaluatedAt: r.evaluatedAt.toISOString(),
        })),
        count: rows.length,
      });
    } catch (err) {
      logger.error({ err }, "Failed to get opportunity score history");
      res.status(500).json({ error: "Failed to get opportunity score history" });
    }
  });

  return router;
}
