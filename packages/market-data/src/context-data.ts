import { createHash } from "node:crypto";
import { z } from "zod";

export const DataDomainSchema = z.enum(["MACRO", "NEWS", "SENTIMENT", "ONCHAIN"]);
export type DataDomain = z.infer<typeof DataDomainSchema>;
export const DataQualityStatusSchema = z.enum(["VALID", "STALE", "INCOMPLETE", "CONFLICTING", "UNAVAILABLE"]);
export type DataQualityStatus = z.infer<typeof DataQualityStatusSchema>;

export interface DataSnapshot<T = unknown> {
  domain: DataDomain;
  asset: string | null;
  provider: string;
  providerVersion: string;
  observedAt: Date;
  acquiredAt: Date;
  validUntil: Date | null;
  qualityScore: number;
  qualityStatus: DataQualityStatus;
  sampleSize: number | null;
  methodologyVersion: string | null;
  payloadHash: string;
  payload: T;
}

export interface MacroSnapshotPayload {
  btcDominance: number | null;
  totalMarketCapUsd: number | null;
  fearGreedIndex: number | null;
  sp500Change24h: number | null;
  dxy: number | null;
  fedFundsRate: number | null;
}

export interface ContextDataProvider<T> {
  readonly domain: DataDomain;
  readonly name: string;
  readonly version: string;
  fetch(asset?: string): Promise<DataSnapshot<T>>;
}

export function stablePayloadHash(payload: unknown): string {
  const canonical = JSON.stringify(payload, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    }
    return value;
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function evaluateFreshness(observedAt: Date, acquiredAt: Date, maxAgeMs: number): DataQualityStatus {
  const age = acquiredAt.getTime() - observedAt.getTime();
  if (age < 0 || age > maxAgeMs) return "STALE";
  return "VALID";
}

function unavailable<T>(domain: DataDomain, provider: string, version: string, acquiredAt: Date, reason: string): DataSnapshot<T> {
  const payload = { reason };
  return {
    domain, asset: null, provider, providerVersion: version, observedAt: acquiredAt,
    acquiredAt, validUntil: null, qualityScore: 0, qualityStatus: "UNAVAILABLE",
    sampleSize: 0, methodologyVersion: null, payloadHash: stablePayloadHash(payload), payload,
  } as DataSnapshot<T>;
}

export class AlternativeFearGreedProvider implements ContextDataProvider<Pick<MacroSnapshotPayload, "fearGreedIndex">> {
  readonly domain = "MACRO" as const;
  readonly name = "alternative-me-fear-greed";
  readonly version = "1";
  constructor(private readonly baseUrl = "https://api.alternative.me") {}
  async fetch(): Promise<DataSnapshot<Pick<MacroSnapshotPayload, "fearGreedIndex">>> {
    const acquiredAt = new Date();
    try {
      const response = await fetch(`${this.baseUrl}/fng/?limit=1`);
      if (!response.ok) throw new Error(`provider returned ${response.status}`);
      const raw = (await response.json()) as { data?: Array<{ value?: string; timestamp?: string }> };
      const item = raw.data?.[0];
      if (!item?.value) throw new Error("missing fear-and-greed value");
      const observedAt = item.timestamp ? new Date(Number(item.timestamp) * 1000) : acquiredAt;
      const payload = { fearGreedIndex: Number(item.value) };
      const qualityStatus = evaluateFreshness(observedAt, acquiredAt, 36 * 60 * 60 * 1000);
      return { domain: this.domain, asset: null, provider: this.name, providerVersion: this.version, observedAt, acquiredAt, validUntil: null, qualityScore: qualityStatus === "VALID" ? 1 : 0, qualityStatus, sampleSize: 1, methodologyVersion: "provider-v1", payloadHash: stablePayloadHash(payload), payload };
    } catch (error) {
      return unavailable(this.domain, this.name, this.version, acquiredAt, error instanceof Error ? error.message : "provider failure");
    }
  }
}

export class CoinGeckoGlobalProvider implements ContextDataProvider<Pick<MacroSnapshotPayload, "btcDominance" | "totalMarketCapUsd">> {
  readonly domain = "MACRO" as const;
  readonly name = "coingecko-global";
  readonly version = "1";
  constructor(private readonly baseUrl = "https://api.coingecko.com/api/v3") {}
  async fetch(): Promise<DataSnapshot<Pick<MacroSnapshotPayload, "btcDominance" | "totalMarketCapUsd">>> {
    const acquiredAt = new Date();
    try {
      const response = await fetch(`${this.baseUrl}/global`);
      if (!response.ok) throw new Error(`provider returned ${response.status}`);
      const raw = (await response.json()) as { data?: { market_cap_percentage?: { btc?: number }; total_market_cap?: { usd?: number }; updated_at?: number } };
      const data = raw.data;
      if (!data?.market_cap_percentage?.btc || !data.total_market_cap?.usd) throw new Error("missing global market data");
      const observedAt = data.updated_at ? new Date(data.updated_at * 1000) : acquiredAt;
      const payload = { btcDominance: data.market_cap_percentage.btc, totalMarketCapUsd: data.total_market_cap.usd };
      const qualityStatus = evaluateFreshness(observedAt, acquiredAt, 2 * 60 * 60 * 1000);
      return { domain: this.domain, asset: null, provider: this.name, providerVersion: this.version, observedAt, acquiredAt, validUntil: null, qualityScore: qualityStatus === "VALID" ? 1 : 0, qualityStatus, sampleSize: 1, methodologyVersion: "provider-v1", payloadHash: stablePayloadHash(payload), payload };
    } catch (error) {
      return unavailable(this.domain, this.name, this.version, acquiredAt, error instanceof Error ? error.message : "provider failure");
    }
  }
}

