export function StatsCard({
  label,
  value,
  subtitle,
  trend,
  icon,
}: {
  label: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow hover:border-border-accent transition-colors duration-200">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-primary tracking-tight">{value}</div>
      {subtitle && (
        <div
          className={`mt-1.5 text-xs font-medium ${
            trend === "up" ? "text-green" : trend === "down" ? "text-red" : "text-secondary"
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

