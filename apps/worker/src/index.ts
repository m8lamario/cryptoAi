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
import {
  createMemoryTrackerQueue,
  createMemoryTrackerWorker,
} from "./queues/memory-tracker.js";
import {
  createEquitySnapshotQueue,
  createEquitySnapshotWorker,
} from "./queues/equity-snapshot.js";
import {
  createAssetUniverseRefreshQueue,
  createAssetUniverseRefreshWorker,
} from "./queues/asset-universe-refresh.js";
import { getScannerConfig } from "@cryptoai/database";
import { createContextDataQueue, createContextDataWorker } from "./queues/context-data.js";
const config = getServerConfig();
const healthQueue = createSystemHealthQueue(config.REDIS_URL);
const healthWorker = createSystemHealthWorker(config.REDIS_URL);
const marketDataQueue = createMarketDataQueue(config.REDIS_URL);
const marketDataWorker = createMarketDataWorker(config.REDIS_URL);
const aiQueue = createAIOrchestrationQueue(config.REDIS_URL);
const aiWorker = createAIOrchestrationWorker(config.REDIS_URL);
const scannerQueue = createMarketScannerQueue(config.REDIS_URL);
const scannerWorker = createMarketScannerWorker(config.REDIS_URL);
const memoryTrackerQueue = createMemoryTrackerQueue(config.REDIS_URL);
const memoryTrackerWorker = createMemoryTrackerWorker(config.REDIS_URL);
const equitySnapshotQueue = createEquitySnapshotQueue(config.REDIS_URL);
const equitySnapshotWorker = createEquitySnapshotWorker(config.REDIS_URL);
const universeQueue = createAssetUniverseRefreshQueue(config.REDIS_URL);
const universeWorker = createAssetUniverseRefreshWorker(config.REDIS_URL);
const scannerConfig = await getScannerConfig();
const universeRefreshMinutes = Math.max(1, scannerConfig.universeRefreshMinutes);
const contextDataQueue = createContextDataQueue(config.REDIS_URL);
const contextDataWorker = createContextDataWorker(config.REDIS_URL);
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
// Memory tracker runs every 15 minutes (v1.4)
await memoryTrackerQueue.add(
  "scheduled-memory",
  {},
  {
    repeat: {
      pattern: "*/15 * * * *",
    },
    jobId: "memory-tracker-scheduled",
  },
);
// Capture paper equity every 15 minutes for the Dashboard 2.0 curve.
await equitySnapshotQueue.add(
  "scheduled-equity-snapshot",
  {},
  {
    repeat: {
      pattern: "*/15 * * * *",
    },
    jobId: "equity-snapshot-scheduled",
  },
);
await universeQueue.add(
  "scheduled-universe-refresh",
  {},
  {
    repeat: { every: universeRefreshMinutes * 60_000 },
    jobId: "asset-universe-refresh-scheduled",
  },
);
await contextDataQueue.add("scheduled-context-data", {}, { repeat: { pattern: "*/15 * * * *" }, jobId: "context-data-scheduled" });
logger.info(
  { universeRefreshMinutes },
  "Worker started — market data every 15m, market scanner every 60s, memory tracker and equity snapshots every 15m (AI triggered on demand)",
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
  await memoryTrackerWorker.close();
  await memoryTrackerQueue.close();
  await equitySnapshotWorker.close();
  await equitySnapshotQueue.close();
  await universeWorker.close();
  await universeQueue.close();
  await contextDataWorker.close();
  await contextDataQueue.close();
  logger.info("Worker shut down gracefully");
  process.exit(0);
}
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
