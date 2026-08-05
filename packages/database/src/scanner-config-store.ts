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
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfigData = {
  maxAssetsToScan: 100,
  maxAssetsForQuant: 10,
  maxAssetsForAI: 5,
  minScoreForAI: 60,
  scannerFrequencyMinutes: 1,
  minVolume24hUsd: 1_000_000,
  minMarketCapUsd: 10_000_000,
};

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
      },
    });
  }

  return {
    maxAssetsToScan: config.maxAssetsToScan,
    maxAssetsForQuant: config.maxAssetsForQuant,
    maxAssetsForAI: config.maxAssetsForAI,
    minScoreForAI: config.minScoreForAI,
    scannerFrequencyMinutes: config.scannerFrequencyMinutes,
    minVolume24hUsd: config.minVolume24hUsd.toNumber(),
    minMarketCapUsd: config.minMarketCapUsd.toNumber(),
  };
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
      maxAssetsToScan: patch.maxAssetsToScan,
      maxAssetsForQuant: patch.maxAssetsForQuant,
      maxAssetsForAI: patch.maxAssetsForAI,
      minScoreForAI: patch.minScoreForAI,
      scannerFrequencyMinutes: patch.scannerFrequencyMinutes,
      minVolume24hUsd: patch.minVolume24hUsd,
      minMarketCapUsd: patch.minMarketCapUsd,
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
    },
  });

  return {
    maxAssetsToScan: config.maxAssetsToScan,
    maxAssetsForQuant: config.maxAssetsForQuant,
    maxAssetsForAI: config.maxAssetsForAI,
    minScoreForAI: config.minScoreForAI,
    scannerFrequencyMinutes: config.scannerFrequencyMinutes,
    minVolume24hUsd: config.minVolume24hUsd.toNumber(),
    minMarketCapUsd: config.minMarketCapUsd.toNumber(),
  };
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
