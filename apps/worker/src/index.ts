import { config as dotenvConfig } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from repository root (apps/worker/src → ../../../.env)
dotenvConfig({ path: join(__dirname, "..", "..", "..", ".env") });

import { getServerConfig } from "@cryptoai/config";
import { logger } from "./logger.js";
import { createSystemHealthQueue, createSystemHealthWorker } from "./queues/system-health.js";

const config = getServerConfig();

const queue = createSystemHealthQueue(config.REDIS_URL);
const worker = createSystemHealthWorker(config.REDIS_URL);

logger.info("Worker started");

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal");
  await worker.close();
  await queue.close();
  logger.info("Worker shut down gracefully");
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
