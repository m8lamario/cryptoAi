import { describe, it, expect } from "vitest";
import {
  BinanceProvider,
  MockProvider,
  SUPPORTED_ASSETS,
  AssetSymbolSchema,
  RawCandleSchema,
  Ticker24hSchema,
} from "../src/index.js";

describe("AssetSymbolSchema", () => {
  it("should accept valid asset symbols", () => {
    expect(AssetSymbolSchema.parse("BTCUSDT")).toBe("BTCUSDT");
    expect(AssetSymbolSchema.parse("ETHUSDT")).toBe("ETHUSDT");
    expect(AssetSymbolSchema.parse("SOLUSDT")).toBe("SOLUSDT");
  });

  it("should reject invalid asset symbols", () => {
    expect(() => AssetSymbolSchema.parse("DOGEUSDT")).toThrow();
    expect(() => AssetSymbolSchema.parse("")).toThrow();
    expect(() => AssetSymbolSchema.parse(123)).toThrow();
  });
});

describe("RawCandleSchema", () => {
  it("should validate a correct raw candle", () => {
    const candle = {
      openTime: 1700000000000,
      closeTime: 1700000900000,
      open: 50000.5,
      high: 50100.2,
      low: 49900.1,
      close: 50050.0,
      volume: 1234.56,
      quoteVolume: 62000000,
      trades: 1500,
    };
    expect(RawCandleSchema.parse(candle)).toEqual(candle);
  });

  it("should reject an invalid candle", () => {
    expect(() => RawCandleSchema.parse({})).toThrow();
    expect(() => RawCandleSchema.parse({ openTime: "not-a-number" })).toThrow();
  });
});

describe("Ticker24hSchema", () => {
  it("should validate a correct ticker", () => {
    const ticker = {
      symbol: "BTCUSDT",
      price: 50000.0,
      changePercent24h: 2.5,
      volume24h: 10000000,
      high24h: 51000,
      low24h: 49000,
    };
    expect(Ticker24hSchema.parse(ticker)).toEqual(ticker);
  });
});

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("should return synthetic candles", async () => {
    const candles = await provider.getCandles({
      symbol: "BTCUSDT",
      interval: "15m",
      limit: 5,
    });
    expect(candles).toHaveLength(5);
    for (const c of candles) {
      expect(RawCandleSchema.parse(c)).toEqual(c);
      expect(c.openTime).toBeLessThan(c.closeTime);
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
      expect(c.low).toBeLessThanOrEqual(c.open);
      expect(c.low).toBeLessThanOrEqual(c.close);
    }
  });

  it("should return synthetic tickers", async () => {
    const tickers = await provider.getTickers(["BTCUSDT", "ETHUSDT"]);
    expect(tickers).toHaveLength(2);
    expect(tickers.map((t) => t.symbol).sort()).toEqual(["BTCUSDT", "ETHUSDT"]);
    for (const t of tickers) {
      expect(Ticker24hSchema.parse(t)).toEqual(t);
    }
  });
});

describe("BinanceProvider", () => {
  it("should have correct name", () => {
    const provider = new BinanceProvider();
    expect(provider.name).toBe("binance");
  });

  it("should accept custom base URL", () => {
    const provider = new BinanceProvider("http://test.local");
    expect(provider.name).toBe("binance");
  });
});

