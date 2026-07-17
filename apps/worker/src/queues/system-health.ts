import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";
import { logger } from "../logger.js";

export interface SystemHealthJobData {
  checkType: "ping";
}

export interface SystemHealthJobResult {
  healthy: boolean;
  checkedAt: string;
}

export function createSystemHealthQueue(
  redisUrl: string
): Queue<SystemHealthJobData, SystemHealthJobResult> {
  return new Queue<SystemHealthJobData, SystemHealthJobResult>("system-health", {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  });
}

export function createSystemHealthWorker(
  redisUrl: string
): Worker<SystemHealthJobData, SystemHealthJobResult> {
  const worker = new Worker<SystemHealthJobData, SystemHealthJobResult>(
    "system-health",
    async (job: Job<SystemHealthJobData, SystemHealthJobResult>) => {
      logger.info({ jobId: job.id, checkType: job.data.checkType }, "Processing system-health job");

      const result: SystemHealthJobResult = {
        healthy: true,
        checkedAt: new Date().toISOString(),
      };

      logger.info({ jobId: job.id, result }, "System-health job completed");
      return result;
    },
    {
      connection: { url: redisUrl },
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "System-health job failed");
  });

  return worker;
}
