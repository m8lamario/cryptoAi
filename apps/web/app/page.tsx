"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "../components/Sidebar";
import { Hero } from "../components/Hero";
import { EquityCurve } from "../components/EquityCurve";
import { Timeline } from "../components/Timeline";
import { AgentStatusBar } from "../components/AgentStatusBar";
import { AiCosts } from "../components/AiCosts";
import { OverviewTab } from "../components/tabs/OverviewTab";
import { MarketTab } from "../components/tabs/MarketTab";
import { AgentReportsTab } from "../components/tabs/AgentReportsTab";
import { ProposalsTab } from "../components/tabs/ProposalsTab";
import { RiskTab } from "../components/tabs/RiskTab";
import { PortfolioTab } from "../components/tabs/PortfolioTab";
import { BacktestsTab } from "../components/tabs/BacktestsTab";
import { AuditTab } from "../components/tabs/AuditTab";
import { ScannerTab } from "../components/tabs/ScannerTab";
import type { DashboardData } from "./types";

type Tab =
  | "overview"
  | "market"
  | "scanner"
  | "reports"
  | "proposals"
  | "risk"
  | "portfolio"
  | "backtests"
  | "audit";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) { setError(`HTTP ${res.status}`); return; }
      const json = (await res.json()) as DashboardData;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await fetchData();
      if (!cancelled) setLoading(false);
    };
    run();
    const interval = setInterval(fetchData, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-screen bg-bg-primary">
        <div className="flex items-center justify-center flex-1 text-secondary">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm font-medium">Loading dashboard</div>
            <div className="text-xs text-muted mt-1">Fetching system state…</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-bg-primary items-center justify-center">
        <div className="text-center p-8 bg-card border border-border rounded-xl max-w-md">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-red mb-2">Connection Error</h2>
          <p className="text-sm text-secondary mb-4">Could not load dashboard data: {error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchData(); }}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        systemHealthy={data.systemStatus.healthy}
        killSwitchActive={data.killSwitch.active}
      />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-sm border-b border-border px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">
              {activeTab === "overview" && "Dashboard Overview"}
              {activeTab === "market" && "Market Data"}
              {activeTab === "reports" && "Agent Reports"}
              {activeTab === "proposals" && "Trade Proposals"}
              {activeTab === "risk" && "Risk Decisions"}
              {activeTab === "portfolio" && "Paper Portfolio"}
              {activeTab === "backtests" && "Backtest Results"}
              {activeTab === "audit" && "Audit Log"}
              {activeTab === "scanner" && "Scanner"}
            </h2>
            <p className="text-xs text-muted">
              {new Date(data.systemStatus.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data.killSwitch.active && (
              <span className="bg-red text-white px-3 py-1 rounded-lg text-xs font-bold animate-pulse-glow">
                🚨 KILL SWITCH
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${
                data.systemStatus.healthy
                  ? "bg-green-dim text-green"
                  : "bg-red-dim text-red"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  data.systemStatus.healthy ? "bg-green animate-pulse" : "bg-red"
                }`}
              />
              {data.systemStatus.healthy ? "System OK" : "System Error"}
            </span>
          </div>
        </header>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <Hero kpis={data.kpis} />
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                <EquityCurve points={data.equityHistory} />
                <AgentStatusBar agents={data.agentStatuses} />
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <Timeline events={data.timeline} />
                <AiCosts summary={data.aiCostSummary} />
              </div>
              <OverviewTab data={data} />
            </div>
          )}
          {activeTab === "market" && <MarketTab data={data} />}
          {activeTab === "reports" && <AgentReportsTab data={data} />}
          {activeTab === "proposals" && <ProposalsTab data={data} />}
          {activeTab === "risk" && <RiskTab data={data} />}
          {activeTab === "portfolio" && <PortfolioTab data={data} />}
          {activeTab === "backtests" && <BacktestsTab data={data} />}
          {activeTab === "audit" && <AuditTab data={data} />}
          {activeTab === "scanner" && <ScannerTab />}
        </div>
      </main>
    </div>
  );
}
