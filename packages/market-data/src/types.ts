import { z } from "zod";
import { assetRegistry, DEFAULT_ASSETS, type AssetInfo } from "./asset-registry.js";

// Re-export for convenience
export { assetRegistry, DEFAULT_ASSETS, type AssetInfo };

// ---------------------------------------------------------------------------
// Legacy compatibility — SUPPORTED_ASSETS is now backed by the registry
// ---------------------------------------------------------------------------

/** @deprecated Use `assetRegistry.getActiveAssets()` instead. */
export const SUPPORTED_ASSETS: readonly AssetInfo[] = (() => {
  if (!assetRegistry.initialized) assetRegistry.init();
  return assetRegistry.getActiveAssets() as unknown as readonly AssetInfo[];
})();

/** Dynamic asset symbol schema — accepts any registered symbol. */
export const AssetSymbolSchema = z
  .string()
  .refine((val) => assetRegistry.has(val), {
    message: "Unknown or unregistered asset symbol",
  });
export type AssetSymbol = z.infer<typeof AssetSymbolSchema>;

export const CandleIntervalSchema = z.string().default("15m");
export type CandleInterval = z.infer<typeof CandleIntervalSchema>;

/** Raw OHLCV candle from a provider */
export const RawCandleSchema = z.object({
  openTime: z.number(),
  closeTime: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  quoteVolume: z.number(),
  trades: z.number(),
});

export type RawCandle = z.infer<typeof RawCandleSchema>;

/** 24h ticker from a provider */
export const Ticker24hSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  changePercent24h: z.number(),
  volume24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
});

export type Ticker24h = z.infer<typeof Ticker24hSchema>;

/** Market snapshot stored in the database */
export const MarketSnapshotSchema = z.object({
  assetId: z.string(),
  symbol: z.string(),
  price: z.number(),
  change24h: z.number().nullable(),
  volume24h: z.number().nullable(),
  high24h: z.number().nullable(),
  low24h: z.number().nullable(),
  collectedAt: z.string(),
  collectionRunId: z.string().nullable(),
});

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

/** Price candle stored in the database */
export const PriceCandleSchema = z.object({
  assetId: z.string(),
  symbol: z.string(),
  openTime: z.string(),
  closeTime: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  quoteVolume: z.number(),
  trades: z.number(),
  interval: z.string(),
});

export type PriceCandle = z.infer<typeof PriceCandleSchema>;

/** Data collection run status */
export const CollectionRunStatusSchema = z.enum(["RUNNING", "COMPLETED", "FAILED"]);
export type CollectionRunStatus = z.infer<typeof CollectionRunStatusSchema>;
