import { Section } from "./Section";
import type { DashboardAiCostSummary } from "@cryptoai/contracts";

function fmtUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

export function AiCosts({ summary }: { summary: DashboardAiCostSummary }) {
  const maxCost = Math.max(...summary.byAgent.map((agent) => agent.costUsd), 0);

  return (
    <Section title="AI usage & costs" icon="⚡" subtitle="Observed usage across analyst and manager calls">
      <div className="grid grid-cols-2 gap-3 border-b border-border pb-4 md:grid-cols-4">
        <Summary label="Total cost" value={fmtUsd(summary.totalCostUsd)} />
        <Summary label="Prompt tokens" value={summary.totalPromptTokens.toLocaleString()} />
        <Summary label="Completion tokens" value={summary.totalCompletionTokens.toLocaleString()} />
        <Summary label="Avg latency" value={`${Math.round(summary.avgLatencyMs)}ms`} />
      </div>
      <div className="mt-4 space-y-3">
        {summary.byAgent.map((agent) => (
          <div key={agent.agentId}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-secondary">{agent.label}</span>
              <span className="shrink-0 font-mono text-muted">{fmtUsd(agent.costUsd)} · {agent.calls} calls</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-input">
              <div className="h-full rounded-full bg-purple transition-all" style={{ width: `${maxCost > 0 ? (agent.costUsd / maxCost) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-border bg-bg-secondary/50 px-3 py-2 text-xs text-muted">
        {summary.budgetRemainingUsd === null
          ? "Budget remaining is unavailable until an AI budget is configured."
          : `Budget remaining: ${fmtUsd(summary.budgetRemainingUsd)}`}
      </div>
    </Section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-primary">{value}</p>
    </div>
  );
}
