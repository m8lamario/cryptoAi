import type { HealthStatus } from "@cryptoai/contracts";
import type { Request, Response, Router as ExpressRouter } from "express";
import { Router } from "express";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  const body: HealthStatus = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});
