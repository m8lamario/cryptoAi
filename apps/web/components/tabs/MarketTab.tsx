import { Section } from "../Section";
import { Badge } from "../Badge";
import type { DashboardData } from "../../app/types";

function fmt(n: number, d = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }

export function MarketTab({ data }: { data: DashboardData }) {
  const { snapshots, collectionStatus, assetCount } = data.marketData;
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {snapshots.map((s) => (
          <div key={s.symbol} className="bg-card border border-border rounded-xl p-5 hover:border-border-accent transition-all duration-200 hover:shadow-lg group">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">{s.symbol.replace("USDT", "")}</span>
                  <span className="text-xs text-muted bg-bg-input px-1.5 py-0.5 rounded">USDT</span>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {new Date(s.collectedAt).toLocaleTimeString()}
                </div>
              </div>
              <div className={`text-sm font-bold px-2.5 py-1 rounded-lg ${s.change24h !== null && s.change24h >= 0 ? "bg-green-dim text-green" : "bg-red-dim text-red"}`}>
                {s.change24h !== null ? `${s.change24h >= 0 ? "+" : ""}${fmt(s.change24h, 2)}%` : "N/A"}
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight mb-3 group-hover:text-accent transition-colors">
              ${fmt(s.price, 2)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between bg-bg-secondary rounded-lg px-2.5 py-1.5">
                <span className="text-muted">24h High</span>
                <span className="font-semibold">{s.high24h !== null ? fmt(s.high24h, 2) : "—"}</span>
              </div>
              <div className="flex justify-between bg-bg-secondary rounded-lg px-2.5 py-1.5">
                <span className="text-muted">24h Low</span>
                <span className="font-semibold">{s.low24h !== null ? fmt(s.low24h, 2) : "—"}</span>
              </div>
              <div className="flex justify-between bg-bg-secondary rounded-lg px-2.5 py-1.5 col-span-2">
                <span className="text-muted">24h Volume</span>
                <span className="font-semibold">{s.volume24h !== null ? fmt(s.volume24h, 0) : "—"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Collection Status */}
      {collectionStatus && (
        <Section title="Data Collection" icon="⟐" subtitle={`${assetCount} assets tracked`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted uppercase tracking-wider">Status</span>
              <div className="mt-1">
                <Badge variant={collectionStatus.status === "COMPLETED" ? "green" : collectionStatus.status === "FAILED" ? "red" : "yellow"}>
                  {collectionStatus.status}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted uppercase tracking-wider">Provider</span>
              <div className="text-primary font-medium mt-1">{collectionStatus.provider}</div>
            </div>
            <div>
              <span className="text-xs text-muted uppercase tracking-wider">Started</span>
              <div className="text-primary font-medium mt-1">{new Date(collectionStatus.startedAt).toLocaleTimeString()}</div>
            </div>
            <div>
              <span className="text-xs text-muted uppercase tracking-wider">Ended</span>
              <div className="text-primary font-medium mt-1">{collectionStatus.endedAt ? new Date(collectionStatus.endedAt).toLocaleTimeString() : "—"}</div>
            </div>
          </div>
          {collectionStatus.error && (
            <div className="mt-3 bg-red-dim border border-[#4a1a1a] rounded-lg px-3 py-2 text-xs text-red">
              {collectionStatus.error}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

