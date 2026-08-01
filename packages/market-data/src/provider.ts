import type { RawCandle, Ticker24h } from "./types.js";

/**
 * Interface for fetching market data from external providers.
 * All implementations must be deterministic (no AI here).
 *
 * M1: `symbol` is now a plain `string` to support the dynamic asset registry.
 */
export interface MarketDataProvider {
  /** Provider name for logging and audit */
  readonly name: string;

  /**
   * Fetch OHLCV candles for a given symbol and interval.
   * Returns candles sorted by openTime ascending.
   */
  getCandles(params: {
    symbol: string;
    interval: string;
    limit?: number;
  }): Promise<RawCandle[]>;

  /**
   * Fetch 24h ticker for a list of symbols.
   */
  getTickers(symbols: string[]): Promise<Ticker24h[]>;
}
