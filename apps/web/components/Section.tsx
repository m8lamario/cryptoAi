export function Section({
  title,
  subtitle,
  icon,
  children,
  className = "",
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-bg-secondary/50">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-base">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-primary truncate">{title}</h3>
            {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

