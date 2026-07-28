"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  systemStatus: { healthy: boolean; uptime: number; timestamp: string };
  marketData: {
    snapshots: Array<{
      symbol: string; price: number; change24h: number | null;
      volume24h: number | null; high24h: number | null; low24h: number | null;
      collectedAt: string;
    }>;
    collectionStatus: { id: string; status: string; startedAt: string; endedAt: string | null; provider: string; error: string | null } | null;
    assetCount: number;
  };
  agentReports: Array<{ runId: string; agentId: string; asset: string; signal: string | null; score: number; confidence: number; status: string; horizon: string; promptTokens: number; latencyMs: number; estimatedCostUsd: number; createdAt: string }>;
  proposals: Array<{ runId: string; asset: string; action: string | null; confidence: number; status: string; decisionGateResult: string | null; suggestedRiskFraction: number | null; createdAt: string }>;
  riskDecisions: Array<{ id: string; status: string; ruleCode: string; reason: string; asset: string; positionSize: number | null; stopLoss: number | null; createdAt: string }>;
  killSwitch: { active: boolean; reason: string | null; updatedAt: string };
  riskConfig: { maxPortfolioExposurePercent: number; maxAssetExposurePercent: number; maxDailyLossPercent: number; maxDrawdownPercent: number } | null;
  aiCosts: { totalCostUsd: number; totalPromptTokens: number; totalCompletionTokens: number; avgLatencyMs: number };
  auditLog: Array<{ id: string; level: string; type: string; message: string; createdAt: string }>;
}

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatUsd(n: number): string {
  return "$" + formatNum(n, 6);
}

function statusColor(s: string): string {
  switch (s) {
    case "VALID": case "APPROVE": case "COMPLETED": return "text-green-400";
    case "UNAVAILABLE": case "INVALID": case "FAILED": case "CRITICAL": return "text-red-400";
    case "BLOCK": case "AMBIGUOUS": case "RUNNING": return "text-yellow-400";
    case "NO_ACTION": return "text-gray-400";
    default: return "text-white";
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-200 mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as DashboardData;
        if (!cancelled) { setData(json); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-red-400">
        Error loading dashboard: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CryptoAI Dashboard</h1>
          <p className="text-gray-400 text-sm">
            Uptime: {Math.floor(data.systemStatus.uptime / 3600)}h {Math.floor((data.systemStatus.uptime % 3600) / 60)}m
            {" • "}
            {new Date(data.systemStatus.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-3">
          {data.killSwitch.active && (
            <span className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold animate-pulse">
              🚨 KILL SWITCH ACTIVE
            </span>
          )}
          <span className={`px-3 py-1 rounded text-sm ${data.systemStatus.healthy ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200"}`}>
            {data.systemStatus.healthy ? "● System OK" : "● System Error"}
          </span>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-sm">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Market Data */}
      <Section title="📊 Market Data">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.marketData.snapshots.map((s) => (
            <div key={s.symbol} className="bg-gray-800 rounded p-3">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">{s.symbol}</span>
                <span className={s.change24h && s.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                  {s.change24h !== null ? `${s.change24h >= 0 ? "+" : ""}${formatNum(s.change24h, 2)}%` : "N/A"}
                </span>
              </div>
              <div className="text-2xl text-white mt-1">{formatNum(s.price, 2)}</div>
              <div className="text-gray-500 text-xs mt-2">
                H: {s.high24h !== null ? formatNum(s.high24h, 2) : "N/A"} / L: {s.low24h !== null ? formatNum(s.low24h, 2) : "N/A"}
              </div>
              <div className="text-gray-600 text-xs">
                Vol: {s.volume24h !== null ? formatNum(s.volume24h, 0) : "N/A"}
              </div>
            </div>
          ))}
        </div>
        {data.marketData.collectionStatus && (
          <div className="mt-3 text-xs text-gray-500">
            Collection:{" "}
            <span className={statusColor(data.marketData.collectionStatus.status)}>
              {data.marketData.collectionStatus.status}
            </span>
            {" • "}{data.marketData.collectionStatus.provider}
            {" • Assets: "}{data.marketData.assetCount}
            {data.marketData.collectionStatus.error && (
              <span className="text-red-400 ml-2">Error: {data.marketData.collectionStatus.error}</span>
            )}
          </div>
        )}
      </Section>

      {/* AI Costs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-gray-500 text-xs">AI Cost (total)</div>
          <div className="text-white text-lg font-bold">{formatUsd(data.aiCosts.totalCostUsd)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-gray-500 text-xs">Prompt Tokens</div>
          <div className="text-white text-lg font-bold">{data.aiCosts.totalPromptTokens.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-gray-500 text-xs">Completion Tokens</div>
          <div className="text-white text-lg font-bold">{data.aiCosts.totalCompletionTokens.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-gray-500 text-xs">Avg Latency</div>
          <div className="text-white text-lg font-bold">{formatNum(data.aiCosts.avgLatencyMs, 0)}ms</div>
        </div>
      </div>

      {/* Agent Reports + Proposals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="🤖 Latest Agent Reports">
          {data.agentReports.length === 0 ? (
            <p className="text-gray-500 text-sm">No reports yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.agentReports.map((r) => (
                <div key={r.runId} className="bg-gray-800 rounded p-2 text-sm">
                  <div className="flex justify-between">
                    <span>{r.agentId}</span>
                    <span className={statusColor(r.status)}>{r.status}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-xs mt-1">
                    <span>{r.asset} • {r.horizon} • signal: {r.signal ?? "null"}</span>
                    <span>score: {formatNum(r.score)} • conf: {formatNum(r.confidence)}</span>
                  </div>
                  <div className="text-gray-600 text-xs">
                    {r.promptTokens}T • {r.latencyMs}ms • {formatUsd(r.estimatedCostUsd)}
                    {" • "}{new Date(r.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="📈 Latest Proposals">
          {data.proposals.length === 0 ? (
            <p className="text-gray-500 text-sm">No proposals yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.proposals.map((p) => (
                <div key={p.runId} className="bg-gray-800 rounded p-2 text-sm">
                  <div className="flex justify-between">
                    <span>{p.asset}</span>
                    <span className={statusColor(p.status)}>{p.status}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-xs mt-1">
                    <span>action: {p.action ?? "null"}</span>
                    <span>conf: {formatNum(p.confidence)}</span>
                  </div>
                  {p.decisionGateResult && (
                    <div className="text-xs text-gray-500">
                      Decision Gate: {p.decisionGateResult}
                      {p.suggestedRiskFraction !== null && ` • risk: ${formatNum(p.suggestedRiskFraction * 100, 1)}%`}
                    </div>
                  )}
                  <div className="text-gray-600 text-xs">{new Date(p.createdAt).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Risk Decisions */}
      <Section title="🛡️ Latest Risk Decisions">
        {data.riskDecisions.length === 0 ? (
          <p className="text-gray-500 text-sm">No decisions yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.riskDecisions.map((d) => (
              <div key={d.id} className="flex justify-between bg-gray-800 rounded p-2 text-sm">
                <div>
                  <span className={statusColor(d.status)}>{d.status}</span>
                  <span className="text-gray-400 ml-2">{d.ruleCode}</span>
                </div>
                <div className="text-gray-400 text-xs">
                  {d.asset}
                  {d.positionSize !== null && ` • size: ${formatNum(d.positionSize, 4)}`}
                  {d.stopLoss !== null && ` • SL: ${formatNum(d.stopLoss, 2)}`}
                  {" • "}{new Date(d.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Risk Config */}
      {data.riskConfig && (
        <Section title="⚙️ Risk Configuration">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Max Portfolio Exposure:</span>
              <span className="text-white ml-2 font-bold">{data.riskConfig.maxPortfolioExposurePercent}%</span>
            </div>
            <div>
              <span className="text-gray-500">Max Asset Exposure:</span>
              <span className="text-white ml-2 font-bold">{data.riskConfig.maxAssetExposurePercent}%</span>
            </div>
            <div>
              <span className="text-gray-500">Max Daily Loss:</span>
              <span className="text-white ml-2 font-bold">{data.riskConfig.maxDailyLossPercent}%</span>
            </div>
            <div>
              <span className="text-gray-500">Max Drawdown:</span>
              <span className="text-white ml-2 font-bold">{data.riskConfig.maxDrawdownPercent}%</span>
            </div>
          </div>
        </Section>
      )}

      {/* Audit Log */}
      <Section title="📋 Audit Log (last 50 events)">
        <div className="space-y-1 max-h-48 overflow-y-auto text-xs font-mono">
          {data.auditLog.map((e) => (
            <div key={e.id} className="flex gap-3">
              <span className={statusColor(e.level)}>{e.level.padEnd(8)}</span>
              <span className="text-gray-500 w-20">{e.type}</span>
              <span className="text-gray-400 flex-1">{e.message}</span>
              <span className="text-gray-600">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
