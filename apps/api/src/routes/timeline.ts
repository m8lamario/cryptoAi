import { Router } from "express";
import { z } from "zod";
import { fetchTimeline } from "../dashboard-data.js";
import { logger } from "../logger.js";

const querySchema = z.object({
  asset: z.string().trim().min(1).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function createTimelineRouter(): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid timeline query", details: parsed.error.issues });
      return;
    }

    try {
      const data = await fetchTimeline(parsed.data.asset, parsed.data.limit);
      res.json({ data });
    } catch (err) {
      logger.error({ err }, "Failed to fetch dashboard timeline");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
