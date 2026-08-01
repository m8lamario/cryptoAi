import { Badge } from "./Badge";
import type { DashboardKpiResponse } from "@cryptoai/contracts";

function fmtUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function statusVariant(status: DashboardKpiResponse["aiStatus"]): "green" | "red" | "yellow" {
  if (status === "ACTIVE") return "green";
  if (status === "ERROR") return "red";
  return "yellow";
}

export function Hero({ kpis }: { kpis: DashboardKpiResponse }) {
  const pnlPositive = kpis.totalPnl >= 0;
  const dailyPositive = kpis.dailyPnl >= 0;

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-[#182538] via-bg-card to-bg-card p-5 shadow-lg md:p-6 animate-fade-in">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Paper portfolio</span>
            <Badge variant="blue">No real orders</Badge>
          </div>
          <p className="text-sm text-secondary">Current equity</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-primary md:text-5xl">{fmtUsd(kpis.equity)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className={pnlPositive ? "text-green" : "text-red"}>
              Total P&amp;L {fmtUsd(kpis.totalPnl)} ({fmtPercent(kpis.totalPnlPercent)})
            </span>
            <span className={dailyPositive ? "text-green" : "text-red"}>
              Today {fmtUsd(kpis.dailyPnl)} ({fmtPercent(kpis.dailyPnlPercent)})
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          <Badge variant="blue">Mode: {kpis.operatingMode}</Badge>
          <Badge variant={statusVariant(kpis.aiStatus)} pulse={kpis.aiStatus === "ERROR"}>
            AI {kpis.aiStatus}
          </Badge>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border/70 pt-4 md:grid-cols-4">
        <Metric label="ROI" value={fmtPercent(kpis.roi)} positive={kpis.roi >= 0} />
        <Metric label="Max drawdown" value={kpis.maxDrawdown === null ? "—" : `${kpis.maxDrawdown.toFixed(2)}%`} positive={false} />
        <Metric label="Win rate" value={kpis.winRate === null ? "Not available" : `${(kpis.winRate * 100).toFixed(1)}%`} />
        <Metric label="Profit factor" value={kpis.profitFactor === null ? "Not available" : kpis.profitFactor.toFixed(2)} />
      </div>
    </section>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${positive === undefined ? "text-primary" : positive ? "text-green" : "text-red"}`}>
        {value}
      </p>
    </div>
  );
}
