import { Queue, Worker } from "bullmq";
import {
  runMemoryTracker,
  type MemoryTrackerJobData,
  type MemoryTrackerJobResult,
} from "../jobs/memory-tracker.js";
import { logger } from "../logger.js";

export const MEMORY_TRACKER_QUEUE = "memory-tracker";

export function createMemoryTrackerQueue(redisUrl: string): Queue<MemoryTrackerJobData, MemoryTrackerJobResult> {
  const connection = new URL(redisUrl);
  return new Queue<MemoryTrackerJobData, MemoryTrackerJobResult>(MEMORY_TRACKER_QUEUE, {
    connection: {
      host: connection.hostname,
      port: Number.parseInt(connection.port || "6379", 10),
      password: connection.password || undefined,
    },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86_400 },
    },
  });
}

export function createMemoryTrackerWorker(
  redisUrl: string,
): Worker<MemoryTrackerJobData, MemoryTrackerJobResult> {
  const connection = new URL(redisUrl);
  const worker = new Worker<MemoryTrackerJobData, MemoryTrackerJobResult>(
    MEMORY_TRACKER_QUEUE,
    runMemoryTracker,
    {
      connection: {
        host: connection.hostname,
        port: Number.parseInt(connection.port || "6379", 10),
        password: connection.password || undefined,
      },
      concurrency: 1,
      lockDuration: 120_000,
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, result: job.returnvalue }, "Memory tracker job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Memory tracker job failed");
  });

  return worker;
}

