import { StatsCard } from "../StatsCard";
import { Badge } from "../Badge";
import type { DashboardData } from "../../app/types";

function fmt(n: number, d = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtUsd(n: number) { return "$" + fmt(n, 6); }

export function OverviewTab({ data }: { data: DashboardData }) {
  const { systemStatus, aiCosts, paperPortfolio, marketData } = data;
  const dailyPnlPct = paperPortfolio.totalValue > 0
    ? (paperPortfolio.dailyPnl / (paperPortfolio.totalValue - paperPortfolio.dailyPnl)) * 100
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          label="AI Cost"
          value={fmtUsd(aiCosts.totalCostUsd)}
          subtitle={`${aiCosts.totalPromptTokens.toLocaleString()} prompt tokens`}
          icon="⚡"
        />
        <StatsCard
          label="Avg Latency"
          value={`${fmt(aiCosts.avgLatencyMs, 0)}ms`}
          subtitle="Per AI call"
          trend={aiCosts.avgLatencyMs < 3000 ? "up" : "down"}
          icon="⏱"
        />
        <StatsCard
          label="System Uptime"
          value={`${Math.floor(systemStatus.uptime / 3600)}h ${Math.floor((systemStatus.uptime % 3600) / 60)}m`}
          subtitle={new Date(systemStatus.timestamp).toLocaleString()}
          trend={systemStatus.healthy ? "up" : "down"}
          icon="🖥"
        />
        <StatsCard
          label="Data Quality"
          value={marketData.snapshots.length >= 3 ? "Complete" : "Partial"}
          subtitle={`${marketData.snapshots.length}/${marketData.assetCount} assets`}
          trend={marketData.snapshots.length >= 3 ? "up" : "down"}
          icon="📡"
        />
      </div>

      {/* Portfolio & Exposure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Paper Portfolio</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Total Value</span>
              <span className="text-xl font-bold">{fmtUsd(paperPortfolio.totalValue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Daily P&amp;L</span>
              <span className={`text-lg font-bold ${paperPortfolio.dailyPnl >= 0 ? "text-green" : "text-red"}`}>
                {paperPortfolio.dailyPnl >= 0 ? "+" : ""}{fmtUsd(paperPortfolio.dailyPnl)}
                <span className="text-xs ml-1 text-secondary">({dailyPnlPct >= 0 ? "+" : ""}{fmt(dailyPnlPct, 2)}%)</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Exposure</span>
              <span className="text-lg font-bold">{fmtUsd(paperPortfolio.totalExposure)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Cash</span>
              <span className="text-lg font-bold">{fmtUsd(paperPortfolio.balance)}</span>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">AI Usage</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Total Calls</span>
              <span className="text-lg font-bold">{data.agentReports.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Completion Tokens</span>
              <span className="text-lg font-bold">{aiCosts.totalCompletionTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Proposals</span>
              <span className="text-lg font-bold">{data.proposals.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-secondary">Decisions</span>
              <div className="flex gap-2">
                <Badge variant="green">✓ {data.riskDecisions.filter(d => d.status === "APPROVE").length}</Badge>
                <Badge variant="red">✗ {data.riskDecisions.filter(d => d.status === "BLOCK").length}</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: "Kill Switch", active: data.killSwitch.active, desc: data.killSwitch.active ? data.killSwitch.reason ?? "Active" : "Inactive" },
          { label: "Risk Profile", active: data.riskConfig !== null, desc: data.riskConfig ? `Max DD: ${data.riskConfig.maxDrawdownPercent}%` : "Not configured" },
          { label: "Collection", active: data.marketData.collectionStatus?.status === "COMPLETED", desc: data.marketData.collectionStatus?.status ?? "Unknown" },
          { label: "Backtests", active: data.backtestRuns.length > 0, desc: `${data.backtestRuns.length} runs` },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted uppercase tracking-wider">{s.label}</span>
              <span className={`w-2 h-2 rounded-full ${s.active ? "bg-green" : "bg-yellow"}`} />
            </div>
            <div className="text-sm font-semibold mt-2">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

