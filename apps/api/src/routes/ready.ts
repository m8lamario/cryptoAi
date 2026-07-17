import type { ReadinessStatus } from "@cryptoai/contracts";
import type { Request, Response, Router as ExpressRouter } from "express";
import { Router } from "express";
import { checkPostgres } from "../checks/postgres.js";
import { checkRedis } from "../checks/redis.js";

export const readyRouter: ExpressRouter = Router();

readyRouter.get("/", async (_req: Request, res: Response) => {
  const [postgresOk, redisOk] = await Promise.all([checkPostgres(), checkRedis()]);

  const body: ReadinessStatus = {
    ready: postgresOk && redisOk,
    timestamp: new Date().toISOString(),
    checks: {
      postgres: postgresOk ? "ok" : "unavailable",
      redis: redisOk ? "ok" : "unavailable",
    },
  };

  res.status(body.ready ? 200 : 503).json(body);
});
