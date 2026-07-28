import { config as dotenvConfig } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from repository root (apps/api/src → ../../../.env)
dotenvConfig({ path: join(__dirname, "..", "..", "..", ".env") });

import { createApp } from "./app.js";
import { getServerConfig } from "@cryptoai/config";
import { logger } from "./logger.js";
import { PrismaAuthStore } from "./auth/sessionStore.js";

const serverConfig = getServerConfig();

const app = createApp({ authStore: new PrismaAuthStore() });

const server = app.listen(serverConfig.API_PORT, () => {
  logger.info({ port: serverConfig.API_PORT }, "API server started");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Received shutdown signal");
  server.close(() => {
    logger.info("API server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
