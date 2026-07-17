import "dotenv/config";
import { createApp } from "./app.js";
import { getServerConfig } from "@cryptoai/config";
import { logger } from "./logger.js";
import { PrismaAuthStore } from "./auth/sessionStore.js";

const config = getServerConfig();

const app = createApp({ authStore: new PrismaAuthStore() });

const server = app.listen(config.API_PORT, () => {
  logger.info({ port: config.API_PORT }, "API server started");
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
