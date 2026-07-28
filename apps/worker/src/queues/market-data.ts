import { Queue, Worker } from "bullmq";
import {
  collectMarketData,
  type MarketDataCollectionJobData,
  type MarketDataCollectionJobResult,
} from "../jobs/market-data-collection.js";
import { logger } from "../logger.js";

export const MARKET_DATA_QUEUE = "market-data-collection";

export function createMarketDataQueue(redisUrl: string): Queue<MarketDataCollectionJobData> {
  const connection = new URL(redisUrl);
  return new Queue<MarketDataCollectionJobData>(MARKET_DATA_QUEUE, {
    connection: {
      host: connection.hostname,
      port: Number.parseInt(connection.port || "6379", 10),
      password: connection.password || undefined,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
}

export function createMarketDataWorker(
  redisUrl: string,
): Worker<MarketDataCollectionJobData, MarketDataCollectionJobResult> {
  const connection = new URL(redisUrl);
  const worker = new Worker<MarketDataCollectionJobData, MarketDataCollectionJobResult>(
    MARKET_DATA_QUEUE,
    collectMarketData,
    {
      connection: {
        host: connection.hostname,
        port: Number.parseInt(connection.port || "6379", 10),
        password: connection.password || undefined,
      },
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, result: job.returnvalue }, "Market data job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Market data job failed");
  });

  return worker;
}
