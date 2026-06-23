"use client";
import Link from "next/link";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import { ItemThumb } from "@/components/domain";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";
import { formatBps, formatDateTime, cn } from "@/lib/utils";

interface AnomalyItem {
  id: string;
  type: string;
  window: string;
  changeBps: number;
  detectedAt: Date | string;
  item: { id: string; name: string; imageUrl: string | null; latest?: { lowestPrice: number | null } | null };
}

const META: Record<string, { key: string; icon: any; color: string }> = {
  SPIKE_UP: { key: "anom.spikeUp", icon: TrendingUp, color: "text-up" },
  SPIKE_DOWN: { key: "anom.spikeDown", icon: TrendingDown, color: "text-down" },
  VOLUME_SPIKE: { key: "anom.volSpike", icon: Zap, color: "text-amber-400" },
  VOLUME_DROP: { key: "anom.volDrop", icon: Activity, color: "text-muted-foreground" },
};
const WINDOW_LABEL: Record<string, string> = { H1: "1h", H24: "24h", D7: "7d", D30: "30d", D90: "90d" };

export function AnomalyList({ anomalies }: { anomalies: AnomalyItem[] }) {
  const { t } = useT();
  const { fmt } = useMoney();
  if (anomalies.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("common.empty")}</div>;
  }
  return (
    <ul className="divide-y">
      {anomalies.map((a) => {
        const meta = META[a.type] ?? META.SPIKE_UP;
        const Icon = meta.icon;
        const isVolume = a.type.startsWith("VOLUME");
        return (
          <li key={a.id}>
            <Link href={`/items/${a.item.id}`} className="flex items-center gap-3 py-2 transition-colors hover:bg-accent/40 -mx-2 px-2 rounded">
              <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
              <ItemThumb src={a.item.imageUrl} alt={a.item.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t(meta.key)} · {WINDOW_LABEL[a.window]} · {formatDateTime(a.detectedAt)}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-sm font-bold tabular", meta.color)}>
                  {isVolume ? `${(a.changeBps / 10000).toFixed(1)}x` : formatBps(a.changeBps)}
                </div>
                <div className="text-xs text-muted-foreground tabular">{fmt(a.item.latest?.lowestPrice)}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
