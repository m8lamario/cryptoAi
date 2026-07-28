import type { RawCandle, Ticker24h, AssetSymbol } from "./types.js";

/**
 * Interface for fetching market data from external providers.
 * All implementations must be deterministic (no AI here).
 */
export interface MarketDataProvider {
  /** Provider name for logging and audit */
  readonly name: string;

  /**
   * Fetch OHLCV candles for a given symbol and interval.
   * Returns candles sorted by openTime ascending.
   */
  getCandles(params: {
    symbol: AssetSymbol;
    interval: string;
    limit?: number;
  }): Promise<RawCandle[]>;

  /**
   * Fetch 24h ticker for a list of symbols.
   */
  getTickers(symbols: AssetSymbol[]): Promise<Ticker24h[]>;
}

