"use client";

import { useEffect, useState, useCallback } from "react";
import { OpportunityRanking } from "../OpportunityRanking";
import { MarketHeatmap } from "../MarketHeatmap";
import { DynamicWatchlist } from "../DynamicWatchlist";
import { ScannerConfig } from "../ScannerConfig";
import type { OpportunityScoreData, WatchlistAssetData, ScannerConfigData } from "../../app/types";

export function ScannerTab() {
  const [scores, setScores] = useState<OpportunityScoreData[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistAssetData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ScannerConfigData | null>(null);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/opportunity-scores?limit=50");
      if (!res.ok) return;
      const data = (await res.json()) as { scores: OpportunityScoreData[] };
      setScores(data.scores ?? []);
    } catch {
      // silent
    }
  }, []);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = (await res.json()) as { assets: WatchlistAssetData[] };
      setWatchlist(data.assets ?? []);
    } catch {
      // silent
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/scanner-config");
      if (!res.ok) return;
      const data = (await res.json()) as ScannerConfigData;
      setConfig(data ?? null);
    } catch {
      // silent
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchScores();
    fetchWatchlist();
  }, [fetchScores, fetchWatchlist]);

  useEffect(() => {
    refreshAll();
    fetchConfig();
    const interval = setInterval(refreshAll, 30_000);
    const configInterval = setInterval(fetchConfig, 60_000);
    return () => { clearInterval(interval); clearInterval(configInterval); };
  }, [refreshAll, fetchConfig]);

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red mb-2">⚠️</div>
        <p className="text-sm text-secondary">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <OpportunityRanking scores={scores} />
      <MarketHeatmap scores={scores} />
      <DynamicWatchlist assets={watchlist} onRefresh={fetchWatchlist} />
      <ScannerConfig config={config} onRefresh={fetchConfig} />
    </div>
  );
}
