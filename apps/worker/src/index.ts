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
import {
  createMarketScannerQueue,
  createMarketScannerWorker,
} from "./queues/market-scanner.js";
const config = getServerConfig();
const healthQueue = createSystemHealthQueue(config.REDIS_URL);
const healthWorker = createSystemHealthWorker(config.REDIS_URL);
const marketDataQueue = createMarketDataQueue(config.REDIS_URL);
const marketDataWorker = createMarketDataWorker(config.REDIS_URL);
const aiQueue = createAIOrchestrationQueue(config.REDIS_URL);
const aiWorker = createAIOrchestrationWorker(config.REDIS_URL);
const scannerQueue = createMarketScannerQueue(config.REDIS_URL);
const scannerWorker = createMarketScannerWorker(config.REDIS_URL);
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
// Market scanner runs every 60 seconds — event-driven AI trigger (v1.4)
await scannerQueue.add(
  "scheduled-scanner",
  {},
  {
    repeat: {
      pattern: "* * * * *",
    },
    jobId: "market-scanner-scheduled",
  },
);
logger.info(
  "Worker started — market data every 15m, market scanner every 60s (AI triggered on demand)",
);
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal");
  await healthWorker.close();
  await healthQueue.close();
  await marketDataWorker.close();
  await marketDataQueue.close();
  await aiWorker.close();
  await aiQueue.close();
  await scannerWorker.close();
  await scannerQueue.close();
  logger.info("Worker shut down gracefully");
  process.exit(0);
}
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
