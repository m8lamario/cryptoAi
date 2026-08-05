import type { AssetInfo } from "./asset-registry.js";

const BINANCE_BASE_URL = "https://api.binance.com";

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

interface BinanceExchangeInfoSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

/**
 * Fetch the top N USDT trading pairs from Binance sorted by 24h quote volume.
 *
 * Uses two public endpoints:
 * - `/api/v3/ticker/24hr` — all tickers with volume
 * - `/api/v3/exchangeInfo` — symbol metadata (baseAsset, quoteAsset, status)
 */
export async function fetchTopAssets(
  topN: number = 100,
  baseUrl: string = BINANCE_BASE_URL,
): Promise<AssetInfo[]> {
  const [tickers, exchangeInfo] = await Promise.all([
    fetchTickers(baseUrl),
    fetchExchangeInfo(baseUrl),
  ]);

  // Build lookup for exchange info
  const infoByName = new Map<
    string,
    { baseAsset: string; quoteAsset: string; status: string }
  >();
  for (const s of exchangeInfo) {
    infoByName.set(s.symbol, {
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      status: s.status,
    });
  }

  return tickers
    .filter((t) => t.symbol.endsWith("USDT"))
    .filter((t) => {
      const info = infoByName.get(t.symbol);
      return info?.status === "TRADING";
    })
    .filter((t) => {
      // Exclude stablecoins (USDC, USDT, DAI, BUSD, TUSD, USDP, FDUSD)
      const info = infoByName.get(t.symbol);
      const base = info?.baseAsset ?? "";
      const stablecoins = [
        "USDC",
        "USDT",
        "DAI",
        "BUSD",
        "TUSD",
        "USDP",
        "FDUSD",
      ];
      return !stablecoins.includes(base);
    })
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, topN)
    .map((t) => {
      const info = infoByName.get(t.symbol);
      return {
        symbol: t.symbol,
        baseAsset: info?.baseAsset ?? t.symbol.replace("USDT", ""),
        quoteAsset: info?.quoteAsset ?? "USDT",
        name: info?.baseAsset ?? t.symbol.replace("USDT", ""),
      };
    });
}

async function fetchTickers(baseUrl: string): Promise<BinanceTicker24h[]> {
  const url = `${baseUrl}/api/v3/ticker/24hr`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Binance ticker/24hr fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const raw = await response.json();
  // Binance returns an array but may wrap in an object on error
  if (!Array.isArray(raw)) {
    throw new Error("Binance ticker/24hr returned non-array response");
  }
  return raw as BinanceTicker24h[];
}

async function fetchExchangeInfo(baseUrl: string): Promise<BinanceExchangeInfoSymbol[]> {
  const url = `${baseUrl}/api/v3/exchangeInfo`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Binance exchangeInfo fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const raw = (await response.json()) as {
    symbols: BinanceExchangeInfoSymbol[];
  };
  return raw.symbols ?? [];
}

export async function fetchTopAssetUniverse(
  topN: number = 100,
  baseUrl: string = BINANCE_BASE_URL,
): Promise<AssetInfo[]> {
  return fetchTopAssets(topN, baseUrl);
}
