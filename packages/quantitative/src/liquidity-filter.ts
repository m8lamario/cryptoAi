// --- M2: Liquidity Filter (pre-scoring) ---

/**
 * Input data for liquidity filtering.
 * All fields come from the 24h ticker or exchange info.
 */
export interface LiquidityInput {
  symbol: string;
  volume24hUsd: number;
  marketCapUsd?: number | null;
  price: number;
}

export interface LiquidityFilterConfig {
  minVolume24hUsd: number;
  minMarketCapUsd: number;
}

export const DEFAULT_LIQUIDITY_FILTER: LiquidityFilterConfig = {
  minVolume24hUsd: 1_000_000,
  minMarketCapUsd: 10_000_000,
};

/**
 * Filter a list of assets by minimum liquidity criteria.
 *
 * Returns only the assets that pass both the volume and market cap thresholds.
 * Assets with missing market cap data still pass if volume is sufficient
 * (market cap is treated as a soft filter when unavailable).
 */
export function filterByLiquidity(
  assets: LiquidityInput[],
  config: Partial<LiquidityFilterConfig> = {},
): LiquidityInput[] {
  const cfg = { ...DEFAULT_LIQUIDITY_FILTER, ...config };

  return assets.filter((a) => {
    const volumeOk = a.volume24hUsd >= cfg.minVolume24hUsd;
    const capOk =
      a.marketCapUsd === null || a.marketCapUsd === undefined
        ? true // soft: pass if unknown
        : a.marketCapUsd >= cfg.minMarketCapUsd;
    return volumeOk && capOk;
  });
}

