import { describe, expect, it, vi } from "vitest";
import { AlternativeFearGreedProvider, CoinGeckoGlobalProvider, evaluateFreshness, stablePayloadHash } from "../src/context-data.js";

describe("context data contracts", () => {
  it("hashes object keys deterministically", () => {
    expect(stablePayloadHash({ b: 2, a: 1 })).toBe(stablePayloadHash({ a: 1, b: 2 }));
  });
  it("marks future and old observations stale", () => {
    const acquired = new Date("2026-08-05T12:00:00Z");
    expect(evaluateFreshness(new Date("2026-08-05T11:59:00Z"), acquired, 120_000)).toBe("VALID");
    expect(evaluateFreshness(new Date("2026-08-05T11:00:00Z"), acquired, 120_000)).toBe("STALE");
    expect(evaluateFreshness(new Date("2026-08-05T13:00:00Z"), acquired, 120_000)).toBe("STALE");
  });
  it("returns unavailable instead of throwing on provider failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await new AlternativeFearGreedProvider("http://test").fetch();
    expect(result.qualityStatus).toBe("UNAVAILABLE");
    vi.unstubAllGlobals();
  });
  it("normalizes macro provider payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { market_cap_percentage: { btc: 52 }, total_market_cap: { usd: 1_000_000 }, updated_at: Math.floor(Date.now() / 1000) } }) }));
    const result = await new CoinGeckoGlobalProvider("http://test").fetch();
    expect(result.payload).toEqual({ btcDominance: 52, totalMarketCapUsd: 1_000_000 });
    expect(result.qualityStatus).toBe("VALID");
    vi.unstubAllGlobals();
  });
});

