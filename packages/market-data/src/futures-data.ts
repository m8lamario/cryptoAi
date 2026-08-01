const BINANCE_FUTURES_BASE = "https://fapi.binance.com";

// ---------------------------------------------------------------------------
// M2 — Binance Futures public data
// ---------------------------------------------------------------------------

export interface FuturesMetrics {
  symbol: string;
  fundingRate: number | null; // latest funding rate (decimal, e.g. 0.0001 = 0.01%)
  openInterest: number | null; // latest open interest in USDT
  openInterestChange24h: number | null; // % change over 24h (approx)
}

/**
 * Fetch funding rate and open interest from Binance Futures public endpoints.
 * These are available for all USDT-M perpetual contracts.
 * Returns null metrics for assets without futures markets.
 */
export async function fetchFuturesMetrics(
  symbols: string[],
  baseUrl: string = BINANCE_FUTURES_BASE,
): Promise<Map<string, FuturesMetrics>> {
  const map = new Map<string, FuturesMetrics>();

  // Initialize all symbols with nulls
  for (const s of symbols) {
    map.set(s, { symbol: s, fundingRate: null, openInterest: null, openInterestChange24h: null });
  }

  try {
    const [fundingRates, openInterests] = await Promise.all([
      fetchFundingRates(symbols, baseUrl),
      fetchOpenInterests(symbols, baseUrl),
    ]);

    for (const s of symbols) {
      const fr = fundingRates.get(s);
      const oi = openInterests.get(s);
      map.set(s, {
        symbol: s,
        fundingRate: fr ?? null,
        openInterest: oi?.openInterest ?? null,
        openInterestChange24h: oi?.change24h ?? null,
      });
    }
  } catch {
    // Graceful: return nulls for all if futures API is unavailable
  }

  return map;
}

async function fetchFundingRates(
  symbols: string[],
  baseUrl: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const url = `${baseUrl}/fapi/v1/premiumIndex`;

  const response = await fetch(url);
  if (!response.ok) return map;

  const raw = (await response.json()) as {
    symbol: string;
    lastFundingRate: string;
  }[];

  if (!Array.isArray(raw)) return map;

  const symbolSet = new Set(symbols);
  for (const entry of raw) {
    if (symbolSet.has(entry.symbol)) {
      map.set(entry.symbol, Number.parseFloat(entry.lastFundingRate));
    }
  }

  return map;
}

async function fetchOpenInterests(
  symbols: string[],
  baseUrl: string,
): Promise<Map<string, { openInterest: number; change24h: number | null }>> {
  const map = new Map<string, { openInterest: number; change24h: number | null }>();
  const url = `${baseUrl}/fapi/v1/openInterest`;

  const symbolSet = new Set(symbols);
  // Binance fapi/v1/openInterest returns a single symbol
  // We need to call per symbol, but let's batch with Promise.all
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const resp = await fetch(`${url}?symbol=${symbol}`);
      if (!resp.ok) return null;
      const data = (await resp.json()) as { openInterest: string };
      return {
        symbol,
        openInterest: Number.parseFloat(data.openInterest),
      };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      map.set(r.value.symbol, {
        openInterest: r.value.openInterest,
        change24h: null, // Binance doesn't provide 24h OI change in a single call
      });
    }
  }

  return map;
}

