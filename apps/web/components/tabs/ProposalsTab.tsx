import { Section } from "../Section";
import { Badge } from "../Badge";
import type { DashboardData } from "../../app/types";

function fmt(n: number, d = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }

function statusVariant(s: string): "green" | "red" | "yellow" | "blue" | "default" {
  if (s === "VALID" || s === "APPROVE") return "green";
  if (s === "UNAVAILABLE" || s === "INVALID" || s === "FAILED") return "red";
  if (s === "AMBIGUOUS" || s === "MANUAL_REVIEW") return "yellow";
  if (s === "NO_ACTION" || s === "BLOCK") return "default";
  return "blue";
}

function actionVariant(a: string): "green" | "red" | "yellow" | "default" {
  if (a === "BUY") return "green";
  if (a === "SELL") return "red";
  if (a === "WAIT") return "yellow";
  return "default";
}

export function ProposalsTab({ data }: { data: DashboardData }) {
  return (
    <Section
      title="Trade Proposals"
      icon="◇"
      subtitle={`${data.proposals.length} proposals from Investment Manager`}
    >
      {data.proposals.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm">No proposals yet.</p>
          <p className="text-xs mt-1">Proposals are generated after the Investment Manager evaluates agent reports.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.proposals.map((p, i) => {
            const relatedDecisions = data.riskDecisions.filter(d =>
              d.asset === p.asset && Math.abs(new Date(d.createdAt).getTime() - new Date(p.createdAt).getTime()) < 300000
            );
            return (
              <div
                key={p.runId}
                className="bg-bg-secondary border border-border rounded-xl p-4 hover:border-border-accent transition-all duration-200 animate-slide-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="font-bold text-primary">{p.asset}</span>
                  <Badge variant={actionVariant(p.action ?? "")}>{p.action ?? "null"}</Badge>
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                  {p.decisionGateResult && (
                    <Badge variant={statusVariant(p.decisionGateResult)}>Gate: {p.decisionGateResult}</Badge>
                  )}
                  <span className="text-xs text-muted ml-auto">
                    {new Date(p.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted">Confidence</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-bg-input rounded-full h-2">
                        <div
                          className="bg-accent h-2 rounded-full"
                          style={{ width: `${Math.round(p.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold">{fmt(p.confidence, 2)}</span>
                    </div>
                  </div>
                  {p.suggestedRiskFraction !== null && (
                    <div>
                      <span className="text-xs text-muted">Risk Fraction</span>
                      <div className="font-mono text-xs font-semibold mt-0.5">{fmt(p.suggestedRiskFraction * 100, 1)}%</div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-xs text-muted">Decisions</span>
                    <div className="flex gap-1.5 mt-0.5">
                      {relatedDecisions.length > 0
                        ? relatedDecisions.map((d) => (
                            <Badge key={d.id} variant={d.status === "APPROVE" ? "green" : "red"}>
                              {d.ruleCode}
                            </Badge>
                          ))
                        : <span className="text-xs text-secondary">Pending</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

