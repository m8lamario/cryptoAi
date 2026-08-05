import { Router } from "express";
import { logger } from "../logger.js";
import {
  getAgentPerformance,
  getModelPerformance,
  getPromptVersionPerformance,
  getSystemStats,
  getPnlBreakdown,
} from "@cryptoai/analytics";
import { getConfigurationSnapshots, getDecisionAudit } from "@cryptoai/database";

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
   * GET /analytics/model-performance?model=deepseek/deepseek-v4-flash&days=7
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

  /**
   * GET /analytics/pnl?days=7
   * Returns P&L breakdown for a specific number of days.
   */
  router.get("/pnl", async (req, res) => {
    try {
      const days = Math.min(Math.max(Number.parseInt(req.query.days as string, 10) || 7, 1), 365);
      const until = new Date();
      const since = new Date(until.getTime() - days * 86400_000);
      res.json(await getPnlBreakdown(since, until));
    } catch (err) {
      logger.error({ err }, "Failed to fetch P&L breakdown");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/decision/:decisionKey", async (req, res) => {
    try {
      const audit = await getDecisionAudit(String(req.params.decisionKey));
      if (!audit) {
        res.status(404).json({ error: "Decision audit not found" });
        return;
      }
      res.json(audit);
    } catch (err) {
      logger.error({ err }, "Failed to fetch decision audit");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/configuration-snapshots", async (req, res) => {
    try {
      const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
      res.json(await getConfigurationSnapshots(kind as Parameters<typeof getConfigurationSnapshots>[0]));
    } catch (err) {
      logger.error({ err }, "Failed to fetch configuration snapshots");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
