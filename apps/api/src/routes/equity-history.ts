import { Router } from "express";
import { z } from "zod";
import { fetchEquityHistory } from "../dashboard-data.js";
import { logger } from "../logger.js";

const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  interval: z.enum(["15m", "1h", "1d"]).default("1h"),
});

export function createEquityHistoryRouter(): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid equity history query", details: parsed.error.issues });
      return;
    }

    const to = parsed.data.to ?? new Date();
    const from = parsed.data.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (from > to) {
      res.status(400).json({ error: "from must be before to" });
      return;
    }

    try {
      const data = await fetchEquityHistory(from, to, parsed.data.interval);
      res.json({ data, from: from.toISOString(), to: to.toISOString(), interval: parsed.data.interval });
    } catch (err) {
      logger.error({ err }, "Failed to fetch equity history");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
