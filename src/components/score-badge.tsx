"use client";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

const RISK_VARIANT: Record<string, string> = {
  DANGER: "bg-down/15 text-down",
  CAUTION: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  GOOD: "bg-up/15 text-up",
  PROMISING: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
};

/** 投資スコア + リスク区分バッジ。リスク語は i18n (risk.*) で全言語対応。 */
export function ScoreBadge({ score, risk }: { score: number | null; risk?: string | null }) {
  const { t } = useT();
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const r = risk ?? (score >= 80 ? "PROMISING" : score >= 60 ? "GOOD" : score >= 40 ? "CAUTION" : "DANGER");
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold tabular", RISK_VARIANT[r])}>
      {score}
      <span className="font-normal opacity-70">{t(`risk.${r}`)}</span>
    </span>
  );
}
