import { config as dotenvConfig } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from repository root (apps/worker/src → ../../../.env)
dotenvConfig({ path: join(__dirname, "..", "..", "..", ".env") });
import { getServerConfig } from "@cryptoai/config";
import { logger } from "./logger.js";
import { createSystemHealthQueue, createSystemHealthWorker } from "./queues/system-health.js";
import {
  createMarketDataQueue,
  createMarketDataWorker,
} from "./queues/market-data.js";
import {
  createAIOrchestrationQueue,
  createAIOrchestrationWorker,
} from "./queues/ai-orchestration.js";
const config = getServerConfig();
const healthQueue = createSystemHealthQueue(config.REDIS_URL);
const healthWorker = createSystemHealthWorker(config.REDIS_URL);
const marketDataQueue = createMarketDataQueue(config.REDIS_URL);
const marketDataWorker = createMarketDataWorker(config.REDIS_URL);
const aiQueue = createAIOrchestrationQueue(config.REDIS_URL);
const aiWorker = createAIOrchestrationWorker(config.REDIS_URL);
// Schedule market data collection every 15 minutes
await marketDataQueue.add(
  "scheduled-collection",
  { provider: "binance" },
  {
    repeat: {
      pattern: "*/15 * * * *",
    },
    jobId: "market-data-scheduled",
  },
);
// Schedule AI orchestration every hour at :05 (give market data 5 min to settle)
await aiQueue.add(
  "scheduled-ai-cycle",
  {},
  {
    repeat: {
      pattern: "5 * * * *",
    },
    jobId: "ai-cycle-scheduled",
  },
);
logger.info("Worker started — market data every 15m, AI cycle hourly at :05");
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal");
  await healthWorker.close();
  await healthQueue.close();
  await marketDataWorker.close();
  await marketDataQueue.close();
  await aiWorker.close();
  await aiQueue.close();
  logger.info("Worker shut down gracefully");
  process.exit(0);
}
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
