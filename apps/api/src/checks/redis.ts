import { Redis } from "ioredis";
import { logger } from "../logger.js";

export async function checkRedis(): Promise<boolean> {
  const url = process.env["REDIS_URL"];
  if (!url) {
    return false;
  }

  let redis: Redis | undefined;

  try {
    redis = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    logger.warn({ dependency: "redis" }, "Readiness check failed");
    return false;
  } finally {
    redis?.disconnect();
  }
}
