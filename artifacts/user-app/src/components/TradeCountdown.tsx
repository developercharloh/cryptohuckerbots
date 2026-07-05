import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TradeCountdown({
  secondsUntilNextTrade,
  className = "",
  compact = false,
}: {
  secondsUntilNextTrade: number | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const [remaining, setRemaining] = useState(secondsUntilNextTrade ?? null);

  useEffect(() => {
    setRemaining(secondsUntilNextTrade ?? null);
  }, [secondsUntilNextTrade]);

  useEffect(() => {
    if (remaining === null) return;
    const interval = setInterval(() => {
      setRemaining((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining === null]);

  if (remaining === null) return null;

  const isDue = remaining <= 0;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${isDue ? "text-green-400" : "text-muted-foreground"} ${className}`}>
        <Clock className="w-3 h-3" />
        {isDue ? "Trading now…" : `Next trade in ${formatCountdown(remaining)}`}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Clock className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Next Scheduled Trade</p>
        <p className={`text-sm font-bold tabular-nums ${isDue ? "text-green-400" : ""}`}>
          {isDue ? "Trading now…" : formatCountdown(remaining)}
        </p>
      </div>
    </div>
  );
}
