import { Router } from "express";
import { fetchAgentStatuses } from "../dashboard-data.js";
import { logger } from "../logger.js";

export function createAgentStatusRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      res.json({ data: await fetchAgentStatuses() });
    } catch (err) {
      logger.error({ err }, "Failed to fetch agent statuses");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
