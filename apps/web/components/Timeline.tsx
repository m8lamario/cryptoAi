import { Section } from "./Section";
import type { DashboardTimelineEvent } from "@cryptoai/contracts";

const EVENT_STYLES: Record<DashboardTimelineEvent["type"], { icon: string; color: string }> = {
  TRADE_OPEN: { icon: "↗", color: "text-green" },
  TRADE_CLOSE: { icon: "↘", color: "text-accent" },
  STOP_LOSS: { icon: "⌁", color: "text-red" },
  TAKE_PROFIT: { icon: "★", color: "text-green" },
  AI_DECISION: { icon: "◆", color: "text-purple" },
  NEWS: { icon: "N", color: "text-yellow" },
  WHALE: { icon: "W", color: "text-accent" },
  SYSTEM: { icon: "●", color: "text-secondary" },
};

export function Timeline({ events }: { events: DashboardTimelineEvent[] }) {
  return (
    <Section title="Activity timeline" icon="◷" subtitle="Recent decisions, trades and system events">
      {events.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-secondary">No activity recorded yet</p>
          <p className="mt-1 text-xs text-muted">Events will appear after the first paper analysis cycle.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {events.map((event) => {
            const style = EVENT_STYLES[event.type];
            return (
              <li key={event.id} className="relative animate-slide-in">
                <span className={`absolute -left-[1.65rem] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-bg-card text-xs font-bold ${style.color}`}>
                  {style.icon}
                </span>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">{event.type.replaceAll("_", " ")}</span>
                      {event.asset && <span className="font-mono text-xs text-accent">{event.asset}</span>}
                    </div>
                    <p className="mt-1 text-sm text-primary">{event.description}</p>
                  </div>
                  <div className="shrink-0 text-xs text-muted">{formatTime(event.timestamp)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
