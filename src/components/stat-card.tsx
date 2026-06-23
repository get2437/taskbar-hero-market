import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "up" | "down" | "primary" | "warning";
}) {
  const accentClass =
    accent === "up" ? "text-up" : accent === "down" ? "text-down" : accent === "warning" ? "text-amber-400" : accent === "primary" ? "text-primary" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-bold tabular", accentClass)}>{value}</div>
        {sub != null && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
