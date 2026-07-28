import { Router } from "express";
import { logger } from "../logger.js";
import {
  getAgentPerformance,
  getModelPerformance,
  getPromptVersionPerformance,
  getSystemStats,
} from "@cryptoai/analytics";

export const ANALYTICS_ROUTE = "/analytics";

export function createAnalyticsRouter(): Router {
  const router = Router();

  /**
   * GET /analytics/system-stats
   * Returns overall system statistics (last 24h).
   */
  router.get("/system-stats", async (_req, res) => {
    try {
      const stats = await getSystemStats();
      res.json(stats);
    } catch (err) {
      logger.error({ err }, "Failed to fetch system stats");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /analytics/agent-performance?agentId=technical-agent&days=7
   * Returns performance metrics for a specific agent.
   */
  router.get("/agent-performance", async (req, res) => {
    try {
      const agentId = req.query.agentId as string;
      const days = Number.parseInt(req.query.days as string, 10) || 7;

      if (!agentId) {
        res.status(400).json({ error: "agentId query parameter is required" });
        return;
      }

      const since = new Date(Date.now() - days * 86400_000);
      const metrics = await getAgentPerformance(agentId, since);
      res.json(metrics);
    } catch (err) {
      logger.error({ err }, "Failed to fetch agent performance");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /analytics/model-performance?model=deepseek/deepseek-v4-pro&days=7
   * Returns performance metrics per model.
   */
  router.get("/model-performance", async (req, res) => {
    try {
      const model = req.query.model as string | undefined;
      const days = Number.parseInt(req.query.days as string, 10) || 7;
      const since = new Date(Date.now() - days * 86400_000);
      const metrics = await getModelPerformance(model, since);
      res.json(metrics);
    } catch (err) {
      logger.error({ err }, "Failed to fetch model performance");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /analytics/prompt-performance?agentId=technical-agent&days=7
   * Returns performance metrics per prompt version.
   */
  router.get("/prompt-performance", async (req, res) => {
    try {
      const agentId = req.query.agentId as string | undefined;
      const days = Number.parseInt(req.query.days as string, 10) || 7;
      const since = new Date(Date.now() - days * 86400_000);
      const metrics = await getPromptVersionPerformance(agentId, since);
      res.json(metrics);
    } catch (err) {
      logger.error({ err }, "Failed to fetch prompt performance");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}

