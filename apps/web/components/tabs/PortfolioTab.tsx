import { Section } from "../Section";
import { PortfolioSummary } from "../PortfolioSummary";
import type { DashboardData } from "../../app/types";

export function PortfolioTab({ data }: { data: DashboardData }) {
  const { paperPortfolio, proposals, riskDecisions } = data;

  // Recent activity: combine proposals and decisions for timeline
  const activities = [
    ...proposals.map(p => ({
      type: "proposal" as const,
      time: new Date(p.createdAt),
      detail: `${p.asset}: ${p.action ?? "N/A"} (${p.status})`,
      status: p.decisionGateResult ?? p.status,
    })),
    ...riskDecisions.map(d => ({
      type: "decision" as const,
      time: new Date(d.createdAt),
      detail: `${d.asset}: ${d.status} — ${d.ruleCode}`,
      status: d.status,
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 15);

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="Paper Portfolio" icon="⏣" subtitle={`${paperPortfolio.positions.length} open positions`}>
        <PortfolioSummary
          balance={paperPortfolio.balance}
          peakValue={paperPortfolio.peakValue}
          dailyPnl={paperPortfolio.dailyPnl}
          totalExposure={paperPortfolio.totalExposure}
          totalValue={paperPortfolio.totalValue}
          positions={paperPortfolio.positions}
        />
      </Section>

      {/* Activity Timeline */}
      <Section title="Recent Activity" icon="⏳" subtitle={`${activities.length} events`}>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">No recent activity.</div>
        ) : (
          <div className="space-y-1">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-border/30 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  a.status === "APPROVE" || a.status === "VALID" ? "bg-green" :
                  a.status === "BLOCK" || a.status === "INVALID" || a.status === "FAILED" ? "bg-red" : "bg-yellow"
                }`} />
                <span className="text-xs text-muted w-16 flex-shrink-0">{a.time.toLocaleTimeString()}</span>
                <span className="text-xs bg-bg-input px-1.5 py-0.5 rounded font-mono flex-shrink-0">{a.type}</span>
                <span className="text-secondary truncate">{a.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

