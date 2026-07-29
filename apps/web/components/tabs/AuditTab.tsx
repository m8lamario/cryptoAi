import { Section } from "../Section";
import { Badge } from "../Badge";
import type { DashboardData } from "../../app/types";

function levelVariant(l: string): "red" | "yellow" | "green" | "blue" | "default" {
  if (l === "CRITICAL" || l === "ERROR") return "red";
  if (l === "WARN") return "yellow";
  if (l === "INFO") return "blue";
  return "default";
}

export function AuditTab({ data }: { data: DashboardData }) {
  return (
    <Section title="Audit Log" icon="☷" subtitle={`${data.auditLog.length} recent events`}>
      {data.auditLog.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <div className="text-3xl mb-3">📜</div>
          <p className="text-sm">No audit events yet.</p>
          <p className="text-xs mt-1">System events, auth attempts, and critical operations appear here.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {data.auditLog.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-bg-card-hover transition-colors text-xs group"
            >
              <Badge variant={levelVariant(e.level)}>{e.level}</Badge>
              <span className="text-muted font-mono w-20 flex-shrink-0">{e.type}</span>
              <span className="text-secondary flex-1 truncate">{e.message}</span>
              <span className="text-muted flex-shrink-0 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                {new Date(e.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

