import { Queue, Worker } from "bullmq";
import {
  refreshAssetUniverseJob,
  type AssetUniverseRefreshJobData,
  type AssetUniverseRefreshJobResult,
} from "../jobs/asset-universe-refresh.js";
import { logger } from "../logger.js";

export const ASSET_UNIVERSE_REFRESH_QUEUE = "asset-universe-refresh";

function connectionOptions(redisUrl: string) {
  const connection = new URL(redisUrl);
  return {
    host: connection.hostname,
    port: Number.parseInt(connection.port || "6379", 10),
    password: connection.password || undefined,
  };
}

export function createAssetUniverseRefreshQueue(redisUrl: string): Queue<AssetUniverseRefreshJobData> {
  return new Queue(ASSET_UNIVERSE_REFRESH_QUEUE, {
    connection: connectionOptions(redisUrl),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800 },
    },
  });
}

export function createAssetUniverseRefreshWorker(
  redisUrl: string,
): Worker<AssetUniverseRefreshJobData, AssetUniverseRefreshJobResult> {
  const worker = new Worker(
    ASSET_UNIVERSE_REFRESH_QUEUE,
    refreshAssetUniverseJob,
    { connection: connectionOptions(redisUrl), concurrency: 1 },
  );
  worker.on("completed", (job) => logger.info({ jobId: job.id }, "Asset universe refresh completed"));
  worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "Asset universe refresh failed"));
  return worker;
}

