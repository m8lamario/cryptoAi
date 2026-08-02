"use client";
import { Section } from "./Section";
import type { OpportunityScoreData } from "../app/types";
const CLASS_COLORS: Record<string, string> = {
  IGNORE: "bg-bg-input text-muted border-border",
  MONITORING: "bg-[#281d08] text-yellow border-[#4a3a10]",
  QUANTITATIVE_ANALYSIS: "bg-[#0d1f33] text-accent border-[#1a3c5e]",
  AI_ANALYSIS: "bg-[#122818] text-green border-[#1a4a20]",
  MAX_PRIORITY: "bg-[#2a1a08] text-[#f0b040] border-[#4a3a10]",
};
function scoreBar(score: number) {
  if (score >= 80) return "bg-green";
  if (score >= 60) return "bg-accent";
  if (score >= 30) return "bg-yellow";
  return "bg-bg-input";
}
function fmtNum(n: number, d = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function OpportunityRanking({ scores }: { scores: OpportunityScoreData[] }) {
  if (scores.length === 0) {
    return (
      <Section title="Opportunity Ranking" icon="◎" subtitle="No scores yet — scanner is warming up">
        <div className="text-sm text-muted">Run the market scanner to see top opportunities.</div>
      </Section>
    );
  }
  return (
    <Section title="Opportunity Ranking" icon="◎" subtitle={`Top ${scores.length} assets by opportunity score`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted uppercase tracking-wider border-b border-border">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Asset</th>
              <th className="text-left py-2 pr-4">Score</th>
              <th className="text-left py-2 pr-4">24h Chg</th>
              <th className="text-left py-2">Classification</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s.asset} className="border-b border-border hover:bg-bg-card-hover transition-colors">
                <td className="py-2.5 pr-4 text-muted font-mono text-xs">{i + 1}</td>
                <td className="py-2.5 pr-4">
                  <span className="font-semibold text-primary">{s.asset.replace("USDT", "")}</span>
                  <span className="text-xs text-muted ml-1">USDT</span>
                  {s.price !== null && s.price !== undefined && (
                    <div className="text-xs text-muted mt-0.5">${fmtNum(s.price)}</div>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-bg-input rounded-full overflow-hidden max-w-[80px]">
                      <div
                        className={`h-full rounded-full transition-all ${scoreBar(s.score)}`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-primary text-xs w-8 text-right">
                      {s.score}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 pr-4">
                  {s.change24h !== null && s.change24h !== undefined ? (
                    <span className={s.change24h >= 0 ? "text-green font-medium" : "text-red font-medium"}>
                      {s.change24h >= 0 ? "+" : ""}{fmtNum(s.change24h)}%
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${CLASS_COLORS[s.classification] ?? CLASS_COLORS.IGNORE}`}>
                    {s.classification.replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
