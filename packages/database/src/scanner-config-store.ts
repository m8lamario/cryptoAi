import { prisma } from "./prisma-client.js";

// ---------------------------------------------------------------------------
// M1 — Scanner Configuration Store
// ---------------------------------------------------------------------------

export interface ScannerConfigData {
  maxAssetsToScan: number;
  maxAssetsForQuant: number;
  maxAssetsForAI: number;
  minScoreForAI: number;
  scannerFrequencyMinutes: number;
  minVolume24hUsd: number;
  minMarketCapUsd: number;
  universeRefreshMinutes: number;
  cooldownAfterOpenMinutes: number;
  cooldownAfterCloseMinutes: number;
  reevaluationDeltaPercent: number;
  maxDailyAiCalls: number;
  maxDailyAiCostUsd: number;
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfigData = {
  maxAssetsToScan: 100,
  maxAssetsForQuant: 10,
  maxAssetsForAI: 5,
  minScoreForAI: 60,
  scannerFrequencyMinutes: 1,
  minVolume24hUsd: 1_000_000,
  minMarketCapUsd: 10_000_000,
  universeRefreshMinutes: 60,
  cooldownAfterOpenMinutes: 60,
  cooldownAfterCloseMinutes: 60,
  reevaluationDeltaPercent: 3,
  maxDailyAiCalls: 20,
  maxDailyAiCostUsd: 1,
};

function toConfig(config: {
  maxAssetsToScan: number;
  maxAssetsForQuant: number;
  maxAssetsForAI: number;
  minScoreForAI: number;
  scannerFrequencyMinutes: number;
  minVolume24hUsd: { toNumber(): number };
  minMarketCapUsd: { toNumber(): number };
  universeRefreshMinutes: number;
  cooldownAfterOpenMinutes: number;
  cooldownAfterCloseMinutes: number;
  reevaluationDeltaPercent: { toNumber(): number };
  maxDailyAiCalls: number;
  maxDailyAiCostUsd: { toNumber(): number };
}): ScannerConfigData {
  return {
    maxAssetsToScan: config.maxAssetsToScan,
    maxAssetsForQuant: config.maxAssetsForQuant,
    maxAssetsForAI: config.maxAssetsForAI,
    minScoreForAI: config.minScoreForAI,
    scannerFrequencyMinutes: config.scannerFrequencyMinutes,
    minVolume24hUsd: config.minVolume24hUsd.toNumber(),
    minMarketCapUsd: config.minMarketCapUsd.toNumber(),
    universeRefreshMinutes: config.universeRefreshMinutes,
    cooldownAfterOpenMinutes: config.cooldownAfterOpenMinutes,
    cooldownAfterCloseMinutes: config.cooldownAfterCloseMinutes,
    reevaluationDeltaPercent: config.reevaluationDeltaPercent.toNumber(),
    maxDailyAiCalls: config.maxDailyAiCalls,
    maxDailyAiCostUsd: config.maxDailyAiCostUsd.toNumber(),
  };
}

/** Retrieve the scanner configuration, seeding defaults if not present. */
export async function getScannerConfig(): Promise<ScannerConfigData> {
  let config = await prisma.scannerConfig.findFirst({ orderBy: { updatedAt: "desc" } });

  if (!config) {
    config = await prisma.scannerConfig.create({
      data: {
        maxAssetsToScan: DEFAULT_SCANNER_CONFIG.maxAssetsToScan,
        maxAssetsForQuant: DEFAULT_SCANNER_CONFIG.maxAssetsForQuant,
        maxAssetsForAI: DEFAULT_SCANNER_CONFIG.maxAssetsForAI,
        minScoreForAI: DEFAULT_SCANNER_CONFIG.minScoreForAI,
        scannerFrequencyMinutes: DEFAULT_SCANNER_CONFIG.scannerFrequencyMinutes,
        minVolume24hUsd: DEFAULT_SCANNER_CONFIG.minVolume24hUsd,
        minMarketCapUsd: DEFAULT_SCANNER_CONFIG.minMarketCapUsd,
        universeRefreshMinutes: DEFAULT_SCANNER_CONFIG.universeRefreshMinutes,
        cooldownAfterOpenMinutes: DEFAULT_SCANNER_CONFIG.cooldownAfterOpenMinutes,
        cooldownAfterCloseMinutes: DEFAULT_SCANNER_CONFIG.cooldownAfterCloseMinutes,
        reevaluationDeltaPercent: DEFAULT_SCANNER_CONFIG.reevaluationDeltaPercent,
        maxDailyAiCalls: DEFAULT_SCANNER_CONFIG.maxDailyAiCalls,
        maxDailyAiCostUsd: DEFAULT_SCANNER_CONFIG.maxDailyAiCostUsd,
      },
    });
  }

  return toConfig(config);
}

/** Update the scanner configuration (upserts the latest row). */
export async function updateScannerConfig(
  patch: Partial<ScannerConfigData>,
): Promise<ScannerConfigData> {
  const existing = await prisma.scannerConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const config = await prisma.scannerConfig.upsert({
    where: { id: existing?.id ?? "none" },
    update: {
      ...(patch.maxAssetsToScan === undefined ? {} : { maxAssetsToScan: patch.maxAssetsToScan }),
      ...(patch.maxAssetsForQuant === undefined ? {} : { maxAssetsForQuant: patch.maxAssetsForQuant }),
      ...(patch.maxAssetsForAI === undefined ? {} : { maxAssetsForAI: patch.maxAssetsForAI }),
      ...(patch.minScoreForAI === undefined ? {} : { minScoreForAI: patch.minScoreForAI }),
      ...(patch.scannerFrequencyMinutes === undefined ? {} : { scannerFrequencyMinutes: patch.scannerFrequencyMinutes }),
      ...(patch.minVolume24hUsd === undefined ? {} : { minVolume24hUsd: patch.minVolume24hUsd }),
      ...(patch.minMarketCapUsd === undefined ? {} : { minMarketCapUsd: patch.minMarketCapUsd }),
      ...(patch.universeRefreshMinutes === undefined ? {} : { universeRefreshMinutes: patch.universeRefreshMinutes }),
      ...(patch.cooldownAfterOpenMinutes === undefined ? {} : { cooldownAfterOpenMinutes: patch.cooldownAfterOpenMinutes }),
      ...(patch.cooldownAfterCloseMinutes === undefined ? {} : { cooldownAfterCloseMinutes: patch.cooldownAfterCloseMinutes }),
      ...(patch.reevaluationDeltaPercent === undefined ? {} : { reevaluationDeltaPercent: patch.reevaluationDeltaPercent }),
      ...(patch.maxDailyAiCalls === undefined ? {} : { maxDailyAiCalls: patch.maxDailyAiCalls }),
      ...(patch.maxDailyAiCostUsd === undefined ? {} : { maxDailyAiCostUsd: patch.maxDailyAiCostUsd }),
    },
    create: {
      maxAssetsToScan: patch.maxAssetsToScan ?? DEFAULT_SCANNER_CONFIG.maxAssetsToScan,
      maxAssetsForQuant: patch.maxAssetsForQuant ?? DEFAULT_SCANNER_CONFIG.maxAssetsForQuant,
      maxAssetsForAI: patch.maxAssetsForAI ?? DEFAULT_SCANNER_CONFIG.maxAssetsForAI,
      minScoreForAI: patch.minScoreForAI ?? DEFAULT_SCANNER_CONFIG.minScoreForAI,
      scannerFrequencyMinutes:
        patch.scannerFrequencyMinutes ?? DEFAULT_SCANNER_CONFIG.scannerFrequencyMinutes,
      minVolume24hUsd: patch.minVolume24hUsd ?? DEFAULT_SCANNER_CONFIG.minVolume24hUsd,
      minMarketCapUsd: patch.minMarketCapUsd ?? DEFAULT_SCANNER_CONFIG.minMarketCapUsd,
      universeRefreshMinutes: patch.universeRefreshMinutes ?? DEFAULT_SCANNER_CONFIG.universeRefreshMinutes,
      cooldownAfterOpenMinutes: patch.cooldownAfterOpenMinutes ?? DEFAULT_SCANNER_CONFIG.cooldownAfterOpenMinutes,
      cooldownAfterCloseMinutes: patch.cooldownAfterCloseMinutes ?? DEFAULT_SCANNER_CONFIG.cooldownAfterCloseMinutes,
      reevaluationDeltaPercent: patch.reevaluationDeltaPercent ?? DEFAULT_SCANNER_CONFIG.reevaluationDeltaPercent,
      maxDailyAiCalls: patch.maxDailyAiCalls ?? DEFAULT_SCANNER_CONFIG.maxDailyAiCalls,
      maxDailyAiCostUsd: patch.maxDailyAiCostUsd ?? DEFAULT_SCANNER_CONFIG.maxDailyAiCostUsd,
    },
  });

  return toConfig(config);
}

// ---------------------------------------------------------------------------
// Asset Config helpers
// ---------------------------------------------------------------------------

export interface AssetConfigData {
  symbol: string;
  active: boolean;
  isPinned: boolean;
  isExcluded: boolean;
  maxCapitalUsd: number | null;
}

/** Return all active (non-excluded) assets. */
export async function getActiveAssets(): Promise<AssetConfigData[]> {
  const rows = await prisma.asset.findMany({
    where: { active: true, isExcluded: false },
    orderBy: { symbol: "asc" },
  });

  return rows.map((r) => ({
    symbol: r.symbol,
    active: r.active,
    isPinned: r.isPinned,
    isExcluded: r.isExcluded,
    maxCapitalUsd: r.maxCapitalUsd?.toNumber() ?? null,
  }));
}

/** Get config for a single asset. */
export async function getAssetConfig(symbol: string): Promise<AssetConfigData | null> {
  const row = await prisma.asset.findUnique({ where: { symbol } });
  if (!row) return null;
  return {
    symbol: row.symbol,
    active: row.active,
    isPinned: row.isPinned,
    isExcluded: row.isExcluded,
    maxCapitalUsd: row.maxCapitalUsd?.toNumber() ?? null,
  };
}

/** Update config for a single asset. */
export async function setAssetConfig(
  symbol: string,
  patch: { isPinned?: boolean; isExcluded?: boolean; maxCapitalUsd?: number | null },
): Promise<AssetConfigData> {
  const row = await prisma.asset.upsert({
    where: { symbol },
    update: {
      isPinned: patch.isPinned,
      isExcluded: patch.isExcluded,
      maxCapitalUsd: patch.maxCapitalUsd,
    },
    create: {
      symbol,
      baseAsset: symbol.replace("USDT", ""),
      quoteAsset: "USDT",
      name: symbol.replace("USDT", ""),
      isPinned: patch.isPinned ?? false,
      isExcluded: patch.isExcluded ?? false,
      maxCapitalUsd: patch.maxCapitalUsd ?? null,
    },
  });

  return {
    symbol: row.symbol,
    active: row.active,
    isPinned: row.isPinned,
    isExcluded: row.isExcluded,
    maxCapitalUsd: row.maxCapitalUsd?.toNumber() ?? null,
  };
}
