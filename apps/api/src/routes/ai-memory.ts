import { Router } from "express";
import type { Request, Response } from "express";
import { getDecisionMemories } from "@cryptoai/database";

export function createAiMemoryRouter(): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 50;
      const entries = await getDecisionMemories(Math.min(limit, 200));
      res.json({ entries, count: entries.length });
    } catch {
      res.status(500).json({ error: "Failed to get decision memories" });
    }
  });

  return router;
}
