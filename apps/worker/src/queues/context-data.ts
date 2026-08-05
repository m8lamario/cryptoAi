import { Queue, Worker } from "bullmq";
import { collectContextData, type ContextDataCollectionJobData, type ContextDataCollectionJobResult } from "../jobs/context-data-collection.js";
import { logger } from "../logger.js";

export const CONTEXT_DATA_QUEUE = "context-data-collection";
function connectionOptions(redisUrl: string) { const url = new URL(redisUrl); return { host: url.hostname, port: Number.parseInt(url.port || "6379", 10), password: url.password || undefined }; }
export function createContextDataQueue(redisUrl: string): Queue<ContextDataCollectionJobData> { return new Queue(CONTEXT_DATA_QUEUE, { connection: connectionOptions(redisUrl), defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: { age: 86_400 }, removeOnFail: { age: 604_800 } } }); }
export function createContextDataWorker(redisUrl: string): Worker<ContextDataCollectionJobData, ContextDataCollectionJobResult> {
  const worker = new Worker<ContextDataCollectionJobData, ContextDataCollectionJobResult>(CONTEXT_DATA_QUEUE, collectContextData, { connection: connectionOptions(redisUrl), concurrency: 1 });
  worker.on("completed", (job) => logger.info({ jobId: job.id, result: job.returnvalue }, "Context data job completed"));
  worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "Context data job failed"));
  return worker;
}

