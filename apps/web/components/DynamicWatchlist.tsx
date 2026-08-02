"use client";

import { useState } from "react";
import { Section } from "./Section";
import type { WatchlistAssetData } from "../app/types";

async function updateAssetConfig(symbol: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/watchlist/assets/${symbol}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update ${symbol}`);
  return res.json() as Promise<WatchlistAssetData>;
}

export function DynamicWatchlist({
  assets,
  onRefresh,
}: {
  assets: WatchlistAssetData[];
  onRefresh: () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function togglePin(symbol: string, current: boolean) {
    setUpdating(symbol);
    try {
      await updateAssetConfig(symbol, { isPinned: !current });
      onRefresh();
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  }

  async function toggleExclude(symbol: string, current: boolean) {
    setUpdating(symbol);
    try {
      await updateAssetConfig(symbol, { isExcluded: !current });
      onRefresh();
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  }

  if (assets.length === 0) {
    return (
      <Section title="Dynamic Watchlist" icon="☰" subtitle="No assets configured">
        <div className="text-sm text-muted">Add assets to the registry to see them here.</div>
      </Section>
    );
  }

  const pinned = assets.filter((a) => a.isPinned);
  const rest = assets.filter((a) => !a.isPinned);

  return (
    <Section title="Dynamic Watchlist" icon="☰" subtitle={`${assets.length} assets — pin or exclude`}>
      <div className="space-y-2">
        {pinned.length > 0 && (
          <div className="text-xs text-muted uppercase tracking-wider mb-2">📌 Pinned</div>
        )}
        {pinned.map((a) => renderRow(a, updating, togglePin, toggleExclude))}

        {pinned.length > 0 && rest.length > 0 && (
          <div className="text-xs text-muted uppercase tracking-wider mt-4 mb-2">All Assets</div>
        )}
        {rest.slice(0, 30).map((a) => renderRow(a, updating, togglePin, toggleExclude))}
      </div>
    </Section>
  );
}

function renderRow(
  a: WatchlistAssetData,
  updating: string | null,
  togglePin: (s: string, v: boolean) => void,
  toggleExclude: (s: string, v: boolean) => void,
) {
  const isLoading = updating === a.symbol;
  return (
    <div
      key={a.symbol}
      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
        a.isExcluded
          ? "bg-red-dim/30 border-red-dim/50 opacity-60"
          : "bg-bg-card border-border hover:bg-bg-card-hover"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.isPinned ? "bg-accent" : a.isExcluded ? "bg-red" : "bg-muted"}`} />
        <span className="font-medium text-sm text-primary truncate">{a.symbol.replace("USDT", "")}</span>
        <span className="text-xs text-muted">USDT</span>
        {a.isExcluded && <span className="text-[10px] text-red">excluded</span>}
        {a.maxCapitalUsd !== null && (
          <span className="text-[10px] text-muted">cap ${a.maxCapitalUsd.toLocaleString()}</span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <button
          onClick={() => togglePin(a.symbol, a.isPinned)}
          disabled={isLoading}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            a.isPinned
              ? "bg-accent-dim text-accent hover:bg-[#1a3c5e]"
              : "bg-bg-input text-muted hover:text-primary"
          } ${isLoading ? "opacity-50 cursor-wait" : ""}`}
          title={a.isPinned ? "Unpin" : "Pin"}
        >
          {a.isPinned ? "📌" : "Pin"}
        </button>
        <button
          onClick={() => toggleExclude(a.symbol, a.isExcluded)}
          disabled={isLoading}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            a.isExcluded
              ? "bg-red-dim text-red hover:bg-[#4a1a1a]"
              : "bg-bg-input text-muted hover:text-red"
          } ${isLoading ? "opacity-50 cursor-wait" : ""}`}
          title={a.isExcluded ? "Include" : "Exclude"}
        >
          {a.isExcluded ? "Re-include" : "Exclude"}
        </button>
      </div>
    </div>
  );
}

