import { Queue, Worker } from "bullmq";
import {
  captureEquitySnapshot,
  type EquitySnapshotJobData,
  type EquitySnapshotJobResult,
} from "../jobs/equity-snapshot.js";
import { logger } from "../logger.js";

export const EQUITY_SNAPSHOT_QUEUE = "equity-snapshot";

function redisConnection(redisUrl: string) {
  const connection = new URL(redisUrl);
  return {
    host: connection.hostname,
    port: Number.parseInt(connection.port || "6379", 10),
    password: connection.password || undefined,
  };
}

export function createEquitySnapshotQueue(
  redisUrl: string,
): Queue<EquitySnapshotJobData, EquitySnapshotJobResult> {
  return new Queue<EquitySnapshotJobData, EquitySnapshotJobResult>(EQUITY_SNAPSHOT_QUEUE, {
    connection: redisConnection(redisUrl),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86_400 },
    },
  });
}

export function createEquitySnapshotWorker(
  redisUrl: string,
): Worker<EquitySnapshotJobData, EquitySnapshotJobResult> {
  const worker = new Worker<EquitySnapshotJobData, EquitySnapshotJobResult>(
    EQUITY_SNAPSHOT_QUEUE,
    captureEquitySnapshot,
    { connection: redisConnection(redisUrl), concurrency: 1, lockDuration: 30_000 },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, result: job.returnvalue }, "Equity snapshot job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Equity snapshot job failed");
  });
  return worker;
}
