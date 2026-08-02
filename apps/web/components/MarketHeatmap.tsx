"use client";

import { Section } from "./Section";
import type { OpportunityScoreData } from "../app/types";

interface HeatmapProps {
  scores: OpportunityScoreData[];
}

function heatColor(score: number, change24h: number | null | undefined): string {
  // Red = high opportunity + negative trend, Green = high opportunity + positive trend
  const intensity = Math.min(1, score / 100);
  const isPositive = (change24h ?? 0) >= 0;

  if (score < 30) return "bg-bg-input opacity-50";
  if (isPositive) {
    // Green shades
    if (score >= 80) return "bg-[#1a5a2a]";
    if (score >= 60) return "bg-[#1a4a22]";
    return "bg-[#1a3a1a]";
  }
  // Red shades
  if (score >= 80) return "bg-[#5a1a1a]";
  if (score >= 60) return "bg-[#4a1a1a]";
  return "bg-[#3a1a1a]";
}

function sizeClass(volume24h: number | null | undefined): string {
  // Larger cells for higher volume assets
  if (!volume24h || volume24h <= 0) return "col-span-1 row-span-1";
  const vol = Math.log10(volume24h);
  if (vol >= 9) return "col-span-2 row-span-2";
  if (vol >= 8) return "col-span-2 row-span-1";
  return "col-span-1 row-span-1";
}

export function MarketHeatmap({ scores }: { scores: OpportunityScoreData[] }) {
  if (scores.length === 0) {
    return (
      <Section title="Market Heatmap" icon="⬡" subtitle="No data yet">
        <div className="text-sm text-muted">Scores and market data will appear here.</div>
      </Section>
    );
  }

  return (
    <Section title="Market Heatmap" icon="⬡" subtitle="Opportunity, trend & volatility at a glance">
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {scores.slice(0, 40).map((s) => (
          <div
            key={s.asset}
            className={`${heatColor(s.score, s.change24h)} rounded-lg p-3 border border-border/30 hover:border-border-accent transition-all cursor-default min-h-[60px] flex flex-col justify-between ${sizeClass(s.volume24h)}`}
            title={`${s.asset.replace("USDT", "")}: score ${s.score}, 24h ${s.change24h ?? "—"}%`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary/80 truncate">{s.asset.replace("USDT", "")}</span>
              <span className="text-[10px] font-mono font-semibold text-primary/60">{s.score}</span>
            </div>
            <div className="flex items-end justify-between mt-1">
              <span className="text-[10px] text-primary/50 truncate">
                {s.price ? `$${s.price < 1 ? s.price.toFixed(4) : s.price < 100 ? s.price.toFixed(2) : s.price.toFixed(0)}` : ""}
              </span>
              {s.change24h !== null && s.change24h !== undefined && (
                <span className={`text-[10px] font-medium ${s.change24h >= 0 ? "text-green/70" : "text-red/70"}`}>
                  {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

