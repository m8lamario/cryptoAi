import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import { pinoHttp } from "pino-http";
import type { AuthConfig } from "@cryptoai/config";
import { getAuthConfig } from "@cryptoai/config";
import { PrismaAuthStore } from "./auth/sessionStore.js";
import { logger } from "./logger.js";
import { healthRouter } from "./routes/health.js";
import { readyRouter } from "./routes/ready.js";
import { privateRouter } from "./routes/private.js";
import { createMarketDataRouter } from "./routes/market-data.js";
import { requireAuth } from "./auth/middleware.js";
import { createAuthRouter } from "./auth/router.js";
import { InMemoryRateLimiter } from "./auth/rateLimiter.js";
import type { AuthStore } from "./auth/types.js";

export interface AppDeps {
  authStore?: AuthStore;
  rateLimiter?: InMemoryRateLimiter;
  authConfig?: AuthConfig;
}

export function createApp(deps: AppDeps = {}): Express {
  const app = express();
  const authStore = deps.authStore ?? new PrismaAuthStore();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use("/health", healthRouter);
  app.use("/ready", readyRouter);

  const authConfig = deps.authConfig ?? getAuthConfig();
  const rateLimiter =
    deps.rateLimiter ??
    new InMemoryRateLimiter(
      authConfig.loginRateLimitMaxAttempts,
      authConfig.loginRateLimitWindowSeconds * 1000
    );

  app.use("/auth", createAuthRouter(authStore, rateLimiter, authConfig));
  app.use("/private", requireAuth(authStore), privateRouter);
  app.use("/market-data", createMarketDataRouter());

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
