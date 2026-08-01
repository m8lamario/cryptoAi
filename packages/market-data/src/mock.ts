import type { MarketDataProvider } from "./provider.js";
import type { RawCandle, Ticker24h } from "./types.js";

/**
 * Mock market data provider for testing.
 * Returns deterministic synthetic data.
 */
export class MockProvider implements MarketDataProvider {
  readonly name = "mock";

  async getCandles(params: {
    symbol: string;
    interval: string;
    limit?: number;
  }): Promise<RawCandle[]> {
    const { symbol, limit = 10 } = params;
    const candles: RawCandle[] = [];
    const basePrice =
      symbol === "BTCUSDT" ? 50_000 : symbol === "ETHUSDT" ? 3_000 : 100;

    const now = Date.now();
    const intervalMs = 15 * 60 * 1000;

    for (let i = limit - 1; i >= 0; i--) {
      const openTime = now - (i + 1) * intervalMs;
      const closeTime = now - i * intervalMs;
      const open = basePrice + Math.sin(i * 0.5) * 100;
      const close = open + (Math.random() - 0.5) * 200;
      const high = Math.max(open, close) + Math.random() * 50;
      const low = Math.min(open, close) - Math.random() * 50;

      candles.push({
        openTime,
        closeTime,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: 100 + Math.random() * 500,
        quoteVolume: (100 + Math.random() * 500) * close,
        trades: 50 + Math.floor(Math.random() * 200),
      });
    }

    return candles;
  }

  async getTickers(symbols: string[]): Promise<Ticker24h[]> {
    const basePrices: Record<string, number> = {
      BTCUSDT: 50_000,
      ETHUSDT: 3_000,
      SOLUSDT: 100,
      BNBUSDT: 300,
      XRPUSDT: 0.5,
      LINKUSDT: 15,
      SUIUSDT: 2,
      AVAXUSDT: 35,
      DOGEUSDT: 0.1,
    };

    return symbols.map((symbol) => {
      const base = basePrices[symbol] ?? 100;
      const price = base + (Math.random() - 0.5) * 200;
      return {
        symbol,
        price: Math.round(price * 100) / 100,
        changePercent24h: Math.round((Math.random() - 0.5) * 10 * 100) / 100,
        volume24h: 10_000_000 + Math.random() * 5_000_000,
        high24h: price * 1.02,
        low24h: price * 0.98,
      };
    });
  }
}
