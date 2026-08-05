import type { Job } from "bullmq";
import { upsertExternalDataSnapshot } from "@cryptoai/database";
import { AlternativeFearGreedProvider, CoinGeckoGlobalProvider } from "@cryptoai/market-data";
import { logger } from "../logger.js";

export interface ContextDataCollectionJobData { provider?: string; }
export interface ContextDataCollectionJobResult { status: "completed" | "partial" | "failed"; providers: number; validSnapshots: number; unavailableSnapshots: number; error?: string; }

export async function collectContextData(job: Job<ContextDataCollectionJobData, ContextDataCollectionJobResult>): Promise<ContextDataCollectionJobResult> {
  void job;
  const providers = [new AlternativeFearGreedProvider(), new CoinGeckoGlobalProvider()];
  let validSnapshots = 0;
  let unavailableSnapshots = 0;
  try {
    for (const provider of providers) {
      const snapshot = await provider.fetch();
      await upsertExternalDataSnapshot(snapshot, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      if (snapshot.qualityStatus === "VALID") validSnapshots++;
      else unavailableSnapshots++;
    }
    return { status: unavailableSnapshots > 0 ? "partial" : "completed", providers: providers.length, validSnapshots, unavailableSnapshots };
  } catch (err) {
    logger.error({ err }, "Context data collection failed");
    return { status: "failed", providers: providers.length, validSnapshots, unavailableSnapshots, error: err instanceof Error ? err.message : String(err) };
  }
}

