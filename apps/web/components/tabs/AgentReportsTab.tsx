import { Section } from "../Section";
import { Badge } from "../Badge";
import type { DashboardData } from "../../app/types";

function fmt(n: number, d = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtUsd(n: number) { return "$" + fmt(n, 6); }

function statusVariant(s: string): "green" | "red" | "yellow" | "blue" | "default" {
  if (s === "VALID" || s === "APPROVE" || s === "COMPLETED") return "green";
  if (s === "UNAVAILABLE" || s === "INVALID" || s === "FAILED" || s === "CRITICAL") return "red";
  if (s === "BLOCK" || s === "AMBIGUOUS" || s === "RUNNING") return "yellow";
  if (s === "NO_ACTION") return "default";
  return "blue";
}

function signalVariant(s: string): "green" | "red" | "yellow" | "default" {
  if (s === "BUY") return "green";
  if (s === "SELL") return "red";
  if (s === "WAIT") return "yellow";
  return "default";
}

export function AgentReportsTab({ data }: { data: DashboardData }) {
  return (
    <Section
      title="Agent Reports"
      icon="◆"
      subtitle={`${data.agentReports.length} reports`}
    >
      {data.agentReports.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <div className="text-3xl mb-3">📭</div>
          <p className="text-sm">No agent reports yet.</p>
          <p className="text-xs mt-1">Reports will appear after the first AI analysis cycle.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted uppercase tracking-wider border-b border-border">
                <th className="text-left py-3 pr-4">Agent</th>
                <th className="text-left py-3 pr-4">Asset</th>
                <th className="text-left py-3 pr-4">Horizon</th>
                <th className="text-center py-3 pr-4">Signal</th>
                <th className="text-center py-3 pr-4">Score</th>
                <th className="text-center py-3 pr-4">Confidence</th>
                <th className="text-right py-3 pr-4">Tokens</th>
                <th className="text-right py-3 pr-4">Latency</th>
                <th className="text-right py-3 pr-4">Cost</th>
                <th className="text-left py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.agentReports.map((r, i) => (
                <tr
                  key={r.runId}
                  className="border-b border-border/50 hover:bg-bg-card-hover transition-colors animate-slide-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <td className="py-2.5 pr-4">
                    <div className="font-semibold text-primary">{r.agentId}</div>
                    <div className="text-xs text-muted">{new Date(r.createdAt).toLocaleTimeString()}</div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{r.asset}</td>
                  <td className="py-2.5 pr-4"><Badge>{r.horizon}</Badge></td>
                  <td className="py-2.5 pr-4 text-center">
                    <Badge variant={signalVariant(r.signal ?? "")}>{r.signal ?? "null"}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-center font-mono text-xs">{fmt(r.score)}</td>
                  <td className="py-2.5 pr-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-12 bg-bg-input rounded-full h-1.5">
                        <div className="bg-accent h-1.5 rounded-full" style={{ width: `${Math.round(r.confidence * 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono">{fmt(r.confidence, 2)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs text-secondary">{r.promptTokens.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs text-secondary">{r.latencyMs}ms</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs text-secondary">{fmtUsd(r.estimatedCostUsd)}</td>
                  <td className="py-2.5"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

