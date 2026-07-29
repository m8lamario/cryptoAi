import { Queue, Worker } from "bullmq";
import {
  runAIOrchestration,
  type AIOrchestrationJobData,
  type AIOrchestrationJobResult,
} from "../jobs/ai-orchestration.js";
import { logger } from "../logger.js";

export const AI_ORCHESTRATION_QUEUE = "ai-orchestration";

export function createAIOrchestrationQueue(redisUrl: string): Queue<AIOrchestrationJobData> {
  const connection = new URL(redisUrl);
  return new Queue<AIOrchestrationJobData>(AI_ORCHESTRATION_QUEUE, {
    connection: {
      host: connection.hostname,
      port: Number.parseInt(connection.port || "6379", 10),
      password: connection.password || undefined,
    },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800 },
    },
  });
}

export function createAIOrchestrationWorker(
  redisUrl: string,
): Worker<AIOrchestrationJobData, AIOrchestrationJobResult> {
  const connection = new URL(redisUrl);
  const worker = new Worker<AIOrchestrationJobData, AIOrchestrationJobResult>(
    AI_ORCHESTRATION_QUEUE,
    runAIOrchestration,
    {
      connection: {
        host: connection.hostname,
        port: Number.parseInt(connection.port || "6379", 10),
        password: connection.password || undefined,
      },
      concurrency: 1,
      lockDuration: 600_000, // 10 min — AI calls can take time
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, result: job.returnvalue }, "AI orchestration job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "AI orchestration job failed");
  });

  return worker;
}

