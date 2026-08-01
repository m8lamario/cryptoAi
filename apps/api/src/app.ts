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
import { createAnalyticsRouter } from "./routes/analytics.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createOperatingModeRouter } from "./routes/operating-mode.js";
import { createAiMemoryRouter } from "./routes/ai-memory.js";
import { createEquityHistoryRouter } from "./routes/equity-history.js";
import { createTimelineRouter } from "./routes/timeline.js";
import { createAgentStatusRouter } from "./routes/agent-status.js";
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
  const authenticated = requireAuth(authStore);
  app.use("/market-data", authenticated, createMarketDataRouter());
  app.use("/analytics", authenticated, createAnalyticsRouter());
  app.use("/dashboard", authenticated, createDashboardRouter());
  app.use("/operating-mode", authenticated, createOperatingModeRouter());
  app.use("/ai-memory", authenticated, createAiMemoryRouter());
  app.use("/equity-history", authenticated, createEquityHistoryRouter());
  app.use("/timeline", authenticated, createTimelineRouter());
  app.use("/agent-status", authenticated, createAgentStatusRouter());

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
