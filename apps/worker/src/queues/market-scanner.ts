import { Queue, Worker } from "bullmq";
import {
  runMarketScanner,
  type MarketScannerJobData,
  type MarketScannerJobResult,
} from "../jobs/market-scanner.js";
import { logger } from "../logger.js";

export const MARKET_SCANNER_QUEUE = "market-scanner";

export function createMarketScannerQueue(redisUrl: string): Queue<MarketScannerJobData, MarketScannerJobResult> {
  const connection = new URL(redisUrl);
  return new Queue<MarketScannerJobData, MarketScannerJobResult>(MARKET_SCANNER_QUEUE, {
    connection: {
      host: connection.hostname,
      port: Number.parseInt(connection.port || "6379", 10),
      password: connection.password || undefined,
    },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86_400 },
    },
  });
}

export function createMarketScannerWorker(
  redisUrl: string,
): Worker<MarketScannerJobData, MarketScannerJobResult> {
  const connection = new URL(redisUrl);
  const worker = new Worker<MarketScannerJobData, MarketScannerJobResult>(
    MARKET_SCANNER_QUEUE,
    runMarketScanner,
    {
      connection: {
        host: connection.hostname,
        port: Number.parseInt(connection.port || "6379", 10),
        password: connection.password || undefined,
      },
      concurrency: 1,
      lockDuration: 30_000,
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, result: job.returnvalue }, "Market scanner job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Market scanner job failed");
  });

  return worker;
}

