export function Badge({
  variant = "default",
  children,
  pulse = false,
}: {
  variant?: "default" | "green" | "red" | "yellow" | "blue";
  children: React.ReactNode;
  pulse?: boolean;
}) {
  const colors: Record<string, string> = {
    default: "bg-bg-input text-secondary border-border",
    green: "bg-[#122818] text-green border-[#1a4a20]",
    red: "bg-[#271010] text-red border-[#4a1a1a]",
    yellow: "bg-[#281d08] text-yellow border-[#4a3a10]",
    blue: "bg-[#0d1f33] text-accent border-[#1a3c5e]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
        colors[variant]
      } ${pulse ? "animate-pulse-glow" : ""}`}
    >
      {children}
    </span>
  );
}

