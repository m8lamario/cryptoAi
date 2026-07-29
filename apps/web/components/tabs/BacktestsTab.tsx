import { Section } from "../Section";
import { Badge } from "../Badge";
import type { DashboardData } from "../../app/types";

function fmt(n: number, d = 2) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtUsd(n: number) { return "$" + fmt(n, 6); }

export function BacktestsTab({ data }: { data: DashboardData }) {
  const strategies = [...new Set(data.backtestRuns.map(r => r.strategy))];
  return (
    <div className="space-y-6 animate-fade-in">
      <Section
        title="Backtest Runs"
        icon="⌬"
        subtitle={`${data.backtestRuns.length} runs across ${strategies.length} strategies`}
      >
        {data.backtestRuns.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <div className="text-3xl mb-3">🧪</div>
            <p className="text-sm">No backtest runs yet.</p>
            <p className="text-xs mt-1">Backtests compare Buy &amp; Hold, Quantitative Bot, and Hybrid AI strategies.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted uppercase tracking-wider border-b border-border">
                  <th className="text-left py-3 pr-4">Strategy</th>
                  <th className="text-left py-3 pr-4">Asset</th>
                  <th className="text-right py-3 pr-4">Return</th>
                  <th className="text-right py-3 pr-4">Max DD</th>
                  <th className="text-right py-3 pr-4">Sharpe</th>
                  <th className="text-right py-3 pr-4">Sortino</th>
                  <th className="text-right py-3 pr-4">Trades</th>
                  <th className="text-right py-3 pr-4">Final</th>
                  <th className="text-right py-3">AI Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.backtestRuns.map((run) => (
                  <tr key={run.id} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                    <td className="py-3 pr-4"><Badge variant="blue">{run.strategy.replace(/_/g, " ")}</Badge></td>
                    <td className="py-3 pr-4 font-mono text-xs">{run.asset}</td>
                    <td className={`py-3 pr-4 text-right font-bold ${run.totalReturn >= 0 ? "text-green" : "text-red"}`}>
                      {run.totalReturn >= 0 ? "+" : ""}{fmt(run.totalReturn)}%
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs text-yellow">{fmt(run.maxDrawdown)}%</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">{run.sharpeRatio !== null ? fmt(run.sharpeRatio) : "—"}</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">{run.sortinoRatio !== null ? fmt(run.sortinoRatio) : "—"}</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">{run.totalTrades}</td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">{fmtUsd(run.finalQuote)}</td>
                    <td className="py-3 text-right font-mono text-xs text-secondary">{fmtUsd(run.aiCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Strategy Comparison */}
      {data.backtestRuns.length > 0 && (
        <Section title="Strategy Comparison" icon="📊" subtitle="Returns by strategy">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategies.map((strat) => {
              const runs = data.backtestRuns.filter(r => r.strategy === strat);
              const avgReturn = runs.length > 0 ? runs.reduce((s, r) => s + r.totalReturn, 0) / runs.length : 0;
              const avgDD = runs.length > 0 ? runs.reduce((s, r) => s + r.maxDrawdown, 0) / runs.length : 0;
              return (
                <div key={strat} className="bg-bg-secondary border border-border rounded-lg p-4">
                  <div className="text-sm font-semibold text-primary mb-3">{strat.replace(/_/g, " ")}</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Avg Return</span>
                      <span className={avgReturn >= 0 ? "text-green font-bold" : "text-red font-bold"}>{avgReturn >= 0 ? "+" : ""}{fmt(avgReturn)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Avg Max DD</span>
                      <span className="text-yellow font-bold">{fmt(avgDD)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Runs</span>
                      <span className="text-secondary font-bold">{runs.length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

