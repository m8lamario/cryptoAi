import { Section } from "./Section";
import type { DashboardAgentStatus } from "@cryptoai/contracts";

const STATUS_STYLES: Record<DashboardAgentStatus["status"], { dot: string; text: string }> = {
  GREEN: { dot: "bg-green shadow-[0_0_8px_var(--green)]", text: "text-green" },
  YELLOW: { dot: "bg-yellow", text: "text-yellow" },
  RED: { dot: "bg-red", text: "text-red" },
};

export function AgentStatusBar({ agents }: { agents: DashboardAgentStatus[] }) {
  return (
    <Section title="Agent health" icon="◆" subtitle="Freshness of the latest analyst reports">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {agents.map((agent) => {
          const style = STATUS_STYLES[agent.status];
          return (
            <div key={agent.agentId} className="rounded-lg border border-border bg-bg-secondary/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-primary">{agent.label}</span>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} title={agent.status} />
              </div>
              <p className={`mt-2 text-[11px] font-semibold ${style.text}`}>{agent.status}</p>
              <p className="mt-1 truncate text-[11px] text-muted" title={agent.modelUsed ?? undefined}>
                {agent.modelUsed ?? "No report yet"}
              </p>
              <p className="mt-1 text-[11px] text-muted">{agent.lastReportAt ? formatAge(agent.lastReportAt) : "Waiting"}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function formatAge(timestamp: string): string {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (ageMinutes < 1) return "Just now";
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  return `${Math.floor(ageMinutes / 60)}h ago`;
}
