import { cn } from "@/lib/utils";

const ROWS: { key: string; max: number }[] = [
  { key: "scorePrice", max: 25 },
  { key: "scoreVolume", max: 25 },
  { key: "scoreStability", max: 20 },
  { key: "scoreVolatility", max: 15 },
  { key: "scorePopularity", max: 15 },
];

export function ScoreBreakdown({ a, labels }: { a: Record<string, any>; labels?: Record<string, string> }) {
  return (
    <div className="space-y-1.5">
      {ROWS.map((r) => {
        const val = a[r.key] ?? 0;
        const pct = Math.round((val / r.max) * 100);
        return (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">{labels?.[r.key] ?? r.key}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", pct >= 70 ? "bg-up" : pct >= 40 ? "bg-primary" : "bg-amber-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right tabular">{val}/{r.max}</span>
          </div>
        );
      })}
    </div>
  );
}
