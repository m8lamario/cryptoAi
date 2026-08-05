import type { Job } from "bullmq";
import { getScannerConfig, refreshAssetUniverse } from "@cryptoai/database";
import { fetchTopAssets } from "@cryptoai/market-data";
import { logger } from "../logger.js";

export interface AssetUniverseRefreshJobData {
  topN?: number;
}

export interface AssetUniverseRefreshJobResult {
  status: "completed" | "failed";
  version?: string;
  assetCount: number;
  error?: string;
}

export async function refreshAssetUniverseJob(
  job: Job<AssetUniverseRefreshJobData, AssetUniverseRefreshJobResult>,
): Promise<AssetUniverseRefreshJobResult> {
  try {
    const config = await getScannerConfig();
    const assets = await fetchTopAssets(job.data.topN ?? config.maxAssetsToScan);
    const result = await refreshAssetUniverse(assets);
    logger.info({ version: result.version, assetCount: result.assets.length }, "Asset universe refreshed");
    return { status: "completed", version: result.version, assetCount: result.assets.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Asset universe refresh failed");
    return { status: "failed", assetCount: 0, error: message };
  }
}
