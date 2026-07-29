import { Section } from "../Section";
import { Badge } from "../Badge";
import type { DashboardData } from "../../app/types";

function fmt(n: number, d = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }

export function RiskTab({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Risk Config */}
      {data.riskConfig && (
        <Section title="Risk Configuration" icon="⚙" subtitle="Deterministic limits">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Max Portfolio Exposure", value: `${data.riskConfig.maxPortfolioExposurePercent}%`, color: "text-yellow" },
              { label: "Max Asset Exposure", value: `${data.riskConfig.maxAssetExposurePercent}%`, color: "text-yellow" },
              { label: "Max Daily Loss", value: `${data.riskConfig.maxDailyLossPercent}%`, color: "text-red" },
              { label: "Max Drawdown", value: `${data.riskConfig.maxDrawdownPercent}%`, color: "text-red" },
            ].map((r, i) => (
              <div key={i} className="bg-bg-secondary border border-border rounded-lg p-3.5">
                <div className="text-xs text-muted uppercase tracking-wider mb-1.5">{r.label}</div>
                <div className={`text-xl font-bold ${r.color}`}>{r.value}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Kill Switch */}
      <Section title="Kill Switch" icon="🚨" subtitle={data.killSwitch.active ? "ACTIVE — all trading blocked" : "Inactive"}>
        <div className={`rounded-lg p-4 border ${data.killSwitch.active ? "bg-red-dim border-[#4a1a1a]" : "bg-bg-secondary border-border"}`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${data.killSwitch.active ? "bg-red animate-pulse-glow" : "bg-green"}`} />
            <span className={`text-lg font-bold ${data.killSwitch.active ? "text-red" : "text-green"}`}>
              {data.killSwitch.active ? "KILL SWITCH ACTIVE" : "Kill Switch Inactive"}
            </span>
          </div>
          {data.killSwitch.active && data.killSwitch.reason && (
            <p className="text-sm text-red mt-2 ml-6">{data.killSwitch.reason}</p>
          )}
          <p className="text-xs text-muted mt-2 ml-6">
            Last updated: {new Date(data.killSwitch.updatedAt).toLocaleString()}
          </p>
        </div>
      </Section>

      {/* Risk Decisions */}
      <Section
        title="Risk Decisions"
        icon="⟁"
        subtitle={`${data.riskDecisions.length} decisions • ${data.riskDecisions.filter(d => d.status === "APPROVE").length} approved, ${data.riskDecisions.filter(d => d.status === "BLOCK").length} blocked`}
      >
        {data.riskDecisions.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">No risk decisions recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted uppercase tracking-wider border-b border-border">
                  <th className="text-left py-3 pr-4">Status</th>
                  <th className="text-left py-3 pr-4">Rule</th>
                  <th className="text-left py-3 pr-4">Reason</th>
                  <th className="text-left py-3 pr-4">Asset</th>
                  <th className="text-right py-3 pr-4">Position Size</th>
                  <th className="text-right py-3 pr-4">Stop Loss</th>
                  <th className="text-right py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.riskDecisions.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                    <td className="py-2.5 pr-4">
                      <Badge variant={d.status === "APPROVE" ? "green" : "red"}>{d.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-accent">{d.ruleCode}</td>
                    <td className="py-2.5 pr-4 text-xs text-secondary max-w-[200px] truncate" title={d.reason}>{d.reason}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{d.asset}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs">{d.positionSize !== null ? fmt(d.positionSize, 6) : "—"}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs">{d.stopLoss !== null ? fmt(d.stopLoss, 2) : "—"}</td>
                    <td className="py-2.5 text-right text-xs text-muted">{new Date(d.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

