import { Section } from "./Section";
import type { DashboardChartPoint } from "@cryptoai/contracts";

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 18, right: 12, bottom: 28, left: 12 };

function fmtUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function EquityCurve({ points }: { points: DashboardChartPoint[] }) {
  const values = points.map((point) => point.equity);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const range = Math.max(max - min, 1);
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const coordinates = points.map((point, index) => {
    const x = PADDING.left + (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
    const y = PADDING.top + ((max - point.equity) / range) * chartHeight;
    return `${x},${y}`;
  });
  const line = coordinates.join(" ");
  const area = coordinates.length > 0
    ? `${PADDING.left},${HEIGHT - PADDING.bottom} ${line} ${WIDTH - PADDING.right},${HEIGHT - PADDING.bottom}`
    : "";

  return (
    <Section title="Equity curve" icon="⌁" subtitle="Paper equity, last 7 days">
      {points.length === 0 ? (
        <EmptyChart />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between text-xs text-muted">
            <span>{fmtUsd(max)}</span>
            <span>{points.length} observations</span>
            <span>{fmtUsd(min)}</span>
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-56 w-full" role="img" aria-label="Paper equity curve">
            <defs>
              <linearGradient id="equity-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#58a6ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={HEIGHT - PADDING.bottom} y2={HEIGHT - PADDING.bottom} stroke="#2a3a50" />
            {area && <polygon points={area} fill="url(#equity-area)" />}
            <polyline points={line} fill="none" stroke="#58a6ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
            {coordinates.length > 0 && <circle cx={coordinates[coordinates.length - 1]?.split(",")[0]} cy={coordinates[coordinates.length - 1]?.split(",")[1]} r="4" fill="#58a6ff" />}
          </svg>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>{new Date(points[0]?.timestamp ?? "1970-01-01T00:00:00.000Z").toLocaleDateString()}</span>
            <span>{new Date(points[points.length - 1]?.timestamp ?? "1970-01-01T00:00:00.000Z").toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </Section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
      <span className="text-2xl text-muted">⌁</span>
      <p className="mt-2 text-sm text-secondary">No equity snapshots yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted">The worker records paper equity every 15 minutes once a paper balance exists.</p>
    </div>
  );
}
