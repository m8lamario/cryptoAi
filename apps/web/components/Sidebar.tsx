"use client";
import { useState } from "react";

type Tab = "overview" | "market" | "reports" | "proposals" | "risk" | "portfolio" | "backtests" | "audit" | "scanner";

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◉" },
  { id: "market", label: "Market Data", icon: "⟐" },
  { id: "scanner", label: "Scanner", icon: "◎" },
  { id: "reports", label: "Agent Reports", icon: "◆" },
  { id: "proposals", label: "Proposals", icon: "◇" },
  { id: "risk", label: "Risk Decisions", icon: "⟁" },
  { id: "portfolio", label: "Paper Portfolio", icon: "⏣" },
  { id: "backtests", label: "Backtests", icon: "⌬" },
  { id: "audit", label: "Audit Log", icon: "☷" },
];

export function Sidebar({ activeTab, onTabChange, systemHealthy, killSwitchActive }: {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  systemHealthy: boolean;
  killSwitchActive: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-border bg-bg-secondary transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-bg-card border border-border text-accent font-bold text-sm hover:bg-bg-card-hover transition-colors flex-shrink-0"
          title="Toggle sidebar"
        >
          ◈
        </button>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-primary tracking-tight">CryptoAI</div>
            <div className="text-[10px] text-muted uppercase tracking-widest">Console</div>
          </div>
        )}
      </div>

      {/* Status indicators */}
      <div className={`px-4 py-3 border-b border-border flex ${collapsed ? "flex-col gap-2 items-center" : "gap-2"}`}>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-1 ${
            systemHealthy ? "bg-green-dim text-green" : "bg-red-dim text-red"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${systemHealthy ? "bg-green animate-pulse" : "bg-red"}`} />
          {!collapsed && (systemHealthy ? "OK" : "Down")}
        </span>
        {killSwitchActive && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-1 bg-red-dim text-red animate-pulse-glow">
            <span className="w-1.5 h-1.5 rounded-full bg-red inline-block" />
            {!collapsed && "KILL"}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 ${
              activeTab === item.id
                ? "bg-accent-dim text-accent border-r-2 border-accent font-semibold"
                : "text-secondary hover:text-primary hover:bg-bg-card"
            } ${collapsed ? "justify-center px-2" : ""}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-base flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className={`px-4 py-3 border-t border-border ${collapsed ? "text-center" : ""}`}>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className={`text-xs text-muted hover:text-red transition-colors ${collapsed ? "px-1" : ""}`}
          >
            {collapsed ? "⏻" : "Sign out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
