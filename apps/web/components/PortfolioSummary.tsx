import { Badge } from "./Badge";

interface Position {
  asset: string; side: string; quantity: number; entryPrice: number;
  currentPrice: number; unrealizedPnl: number; stopLoss: number | null;
}

export function PortfolioSummary({
  balance, peakValue, dailyPnl, totalExposure, totalValue, positions,
}: {
  balance: number; peakValue: number; dailyPnl: number;
  totalExposure: number; totalValue: number; positions: Position[];
}) {
  const pnlPct = peakValue > 0 ? ((totalValue - peakValue) / peakValue * 100) : 0;
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Cash", value: `$${fmt(balance)}`, icon: "💰" },
          { label: "Total Value", value: `$${fmt(totalValue)}`, icon: "📦" },
          { label: "Exposure", value: `$${fmt(totalExposure)}`, icon: "📊" },
          { label: "Daily P&L", value: `$${fmt(dailyPnl)}`, trend: dailyPnl >= 0 ? "up" as const : "down" as const, icon: "📈" },
          { label: "Peak Value", value: `$${fmt(peakValue)}`, sub: `${pnlPct >= 0 ? "+" : ""}${fmt(pnlPct, 1)}% from peak`, icon: "🏔️" },
        ].map((m, i) => (
          <div key={i} className="bg-bg-secondary rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs">{m.icon}</span>
              <span className="text-xs text-muted uppercase tracking-wider">{m.label}</span>
            </div>
            <div className={`text-lg font-bold ${m.trend === "up" ? "text-green" : m.trend === "down" ? "text-red" : "text-primary"}`}>{m.value}</div>
            {m.sub && <div className="text-xs text-secondary mt-0.5">{m.sub}</div>}
          </div>
        ))}
      </div>
      {positions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted uppercase tracking-wider border-b border-border">
                <th className="text-left py-2 pr-4">Asset</th>
                <th className="text-left py-2 pr-4">Side</th>
                <th className="text-right py-2 pr-4">Qty</th>
                <th className="text-right py-2 pr-4">Entry</th>
                <th className="text-right py-2 pr-4">Mark</th>
                <th className="text-right py-2 pr-4">P&amp;L</th>
                <th className="text-right py-2">Stop Loss</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={`${p.asset}-${p.side}`} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                  <td className="py-2.5 pr-4 font-semibold">{p.asset}</td>
                  <td className="py-2.5 pr-4"><Badge variant={p.side === "LONG" ? "green" : "red"}>{p.side}</Badge></td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs">{fmt(p.quantity, 6)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs">{fmt(p.entryPrice, 2)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs">{fmt(p.currentPrice, 2)}</td>
                  <td className={`py-2.5 pr-4 text-right font-mono text-xs font-semibold ${p.unrealizedPnl >= 0 ? "text-green" : "text-red"}`}>${fmt(p.unrealizedPnl)}</td>
                  <td className="py-2.5 text-right font-mono text-xs text-secondary">{p.stopLoss !== null ? fmt(p.stopLoss, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function fmt(n: number, d = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }

