"use client";

import { useState } from "react";
import { Section } from "./Section";
import type { ScannerConfigData } from "../app/types";

interface Props {
  config: ScannerConfigData | null;
  onRefresh: () => void;
}

async function updateConfig(patch: Partial<ScannerConfigData>) {
  const res = await fetch("/api/scanner-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update scanner config");
  return res.json() as Promise<ScannerConfigData>;
}

export function ScannerConfig({ config, onRefresh }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!config) {
    return (
      <Section title="Scanner Configuration" icon="⚙" subtitle="Loading...">
        <div className="text-sm text-muted shimmer h-20 rounded-lg" />
      </Section>
    );
  }

  async function apply(patch: Partial<ScannerConfigData>) {
    setSaving(true);
    setError(null);
    try {
      await updateConfig(patch);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Scanner Configuration" icon="⚙" subtitle="Tune thresholds, limits & frequency">
      {error && (
        <div className="mb-3 bg-red-dim border border-red/30 rounded-lg px-3 py-2 text-xs text-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Field
          label="Max Assets Scanned"
          value={config.maxAssetsToScan}
          onChange={(v) => apply({ maxAssetsToScan: v })}
          min={1}
          max={500}
          saving={saving}
        />
        <Field
          label="Top for Quant"
          value={config.maxAssetsForQuant}
          onChange={(v) => apply({ maxAssetsForQuant: v })}
          min={1}
          max={100}
          saving={saving}
        />
        <Field
          label="Max for AI"
          value={config.maxAssetsForAI}
          onChange={(v) => apply({ maxAssetsForAI: v })}
          min={1}
          max={50}
          saving={saving}
        />
        <Field
          label="Min Score for AI"
          value={config.minScoreForAI}
          onChange={(v) => apply({ minScoreForAI: v })}
          min={0}
          max={100}
          saving={saving}
        />
        <Field
          label="Frequency (min)"
          value={config.scannerFrequencyMinutes}
          onChange={(v) => apply({ scannerFrequencyMinutes: v })}
          min={1}
          max={1440}
          saving={saving}
        />
        <Field
          label="Min Volume 24h ($)"
          value={config.minVolume24hUsd}
          onChange={(v) => apply({ minVolume24hUsd: v })}
          min={0}
          max={1_000_000_000_000}
          saving={saving}
          format={(v) =>
            v >= 1_000_000_000
              ? `$${(v / 1_000_000_000).toFixed(1)}B`
              : v >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(1)}M`
                : `$${v}`
          }
        />
        <Field
          label="Min Market Cap ($)"
          value={config.minMarketCapUsd}
          onChange={(v) => apply({ minMarketCapUsd: v })}
          min={0}
          max={1_000_000_000_000}
          saving={saving}
          format={(v) =>
            v >= 1_000_000_000
              ? `$${(v / 1_000_000_000).toFixed(1)}B`
              : v >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(1)}M`
                : `$${v}`
          }
        />
      </div>
    </Section>
  );
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
  saving,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  saving: boolean;
  format?: (v: number) => string;
}) {
  const [focused, setFocused] = useState(false);
  const display = format ? format(value) : String(value);

  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 hover:border-border-accent transition-colors">
      <label className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      {focused ? (
        <input
          type="number"
          defaultValue={value}
          min={min}
          max={max}
          disabled={saving}
          autoFocus
          onBlur={(e) => {
            setFocused(false);
            const n = Number(e.target.value);
            if (!isNaN(n) && n !== value && n >= min && n <= max) {
              onChange(n);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setFocused(false);
            }
          }}
          className="w-full bg-bg-input text-primary border border-border rounded px-2 py-1 text-sm font-mono outline-none focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setFocused(true)}
          className="w-full text-left font-mono font-semibold text-primary text-sm hover:text-accent transition-colors cursor-text"
        >
          {display}
        </button>
      )}
    </div>
  );
}

