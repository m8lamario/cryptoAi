import { z } from "zod";

// ---------------------------------------------------------------------------
// M1 — Configurable Asset Registry
// ---------------------------------------------------------------------------

/** Complete metadata for a market asset */
export interface AssetInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  name: string;
}

export const AssetInfoSchema = z.object({
  symbol: z.string().min(1),
  baseAsset: z.string().min(1),
  quoteAsset: z.string().min(1),
  name: z.string().min(1),
});

// ---- Default assets (MVP + intermediate phase) ----

export const DEFAULT_ASSETS: readonly AssetInfo[] = [
  { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", name: "Ethereum" },
  { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", name: "Solana" },
  { symbol: "BNBUSDT", baseAsset: "BNB", quoteAsset: "USDT", name: "BNB" },
  { symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT", name: "XRP" },
  { symbol: "LINKUSDT", baseAsset: "LINK", quoteAsset: "USDT", name: "Chainlink" },
  { symbol: "SUIUSDT", baseAsset: "SUI", quoteAsset: "USDT", name: "Sui" },
  { symbol: "AVAXUSDT", baseAsset: "AVAX", quoteAsset: "USDT", name: "Avalanche" },
  { symbol: "DOGEUSDT", baseAsset: "DOGE", quoteAsset: "USDT", name: "Dogecoin" },
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Runtime asset registry.
 *
 * Replaces the old hardcoded `SUPPORTED_ASSETS` with a configurable registry
 * that can be seeded from defaults and extended at runtime (e.g. from a
 * Binance top-assets scan or from the local `AssetConfig` table).
 */
class AssetRegistry {
  private assets = new Map<string, AssetInfo>();
  private _initialized = false;

  /** Seed the registry. Safe to call multiple times — assets are merged. */
  init(assets?: AssetInfo[]): void {
    const list = assets ?? [...DEFAULT_ASSETS];
    for (const asset of list) {
      this.assets.set(asset.symbol, asset);
    }
    this._initialized = true;
  }

  /** Lazy-init with defaults if not already seeded. */
  private ensureInit(): void {
    if (!this._initialized) this.init();
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /** Add or replace an asset. */
  add(asset: AssetInfo): void {
    this.assets.set(asset.symbol, asset);
    this._initialized = true;
  }

  /** Remove an asset by symbol. */
  remove(symbol: string): void {
    this.assets.delete(symbol);
  }

  /** Bulk-add assets while keeping existing entries. */
  addMany(assets: AssetInfo[]): void {
    for (const a of assets) this.assets.set(a.symbol, a);
    this._initialized = true;
  }

  /** All currently registered assets. */
  getActiveAssets(): AssetInfo[] {
    this.ensureInit();
    return Array.from(this.assets.values());
  }

  /** All registered symbols. */
  getSymbols(): string[] {
    this.ensureInit();
    return Array.from(this.assets.keys());
  }

  /** Look up a single asset. */
  getAsset(symbol: string): AssetInfo | undefined {
    this.ensureInit();
    return this.assets.get(symbol);
  }

  /** Check whether a symbol is registered. */
  has(symbol: string): boolean {
    this.ensureInit();
    return this.assets.has(symbol);
  }

  get size(): number {
    this.ensureInit();
    return this.assets.size;
  }

  /** Clear and re-initialize (useful in tests). */
  reset(assets?: AssetInfo[]): void {
    this.assets.clear();
    this._initialized = false;
    if (assets) this.init(assets);
  }
}

export const assetRegistry = new AssetRegistry();

