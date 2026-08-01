import type { MarketDataProvider } from "./provider.js";
import type { RawCandle, Ticker24h } from "./types.js";

const BINANCE_BASE_URL = "https://api.binance.com";

/**
 * Binance REST API market data provider.
 * Uses public endpoints only — no API key required.
 */
export class BinanceProvider implements MarketDataProvider {
  readonly name = "binance";
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? BINANCE_BASE_URL;
  }

  async getCandles(params: {
    symbol: string;
    interval: string;
    limit?: number;
  }): Promise<RawCandle[]> {
    const { symbol, interval, limit = 100 } = params;
    const url = `${this.baseUrl}/api/v3/klines?${new URLSearchParams({
      symbol,
      interval,
      limit: limit.toString(),
    }).toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Binance candles fetch failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as unknown[];

    return data.map((candle: unknown) => {
      const c = candle as [
        number, // openTime
        string, // open
        string, // high
        string, // low
        string, // close
        string, // volume
        number, // closeTime
        string, // quoteAssetVolume
        number, // numberOfTrades
        string, // takerBuyBaseAssetVolume
        string, // takerBuyQuoteAssetVolume
        string, // ignore
      ];

      return {
        openTime: c[0],
        closeTime: c[6],
        open: Number.parseFloat(c[1]),
        high: Number.parseFloat(c[2]),
        low: Number.parseFloat(c[3]),
        close: Number.parseFloat(c[4]),
        volume: Number.parseFloat(c[5]),
        quoteVolume: Number.parseFloat(c[7]),
        trades: c[8],
      };
    });
  }

  async getTickers(symbols: string[]): Promise<Ticker24h[]> {
    const symbolList = JSON.stringify(symbols);
    const url = `${this.baseUrl}/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolList)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Binance tickers fetch failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
      highPrice: string;
      lowPrice: string;
    }[];

    return data.map((t) => ({
      symbol: t.symbol,
      price: Number.parseFloat(t.lastPrice),
      changePercent24h: Number.parseFloat(t.priceChangePercent),
      volume24h: Number.parseFloat(t.volume),
      high24h: Number.parseFloat(t.highPrice),
      low24h: Number.parseFloat(t.lowPrice),
    }));
  }
}
