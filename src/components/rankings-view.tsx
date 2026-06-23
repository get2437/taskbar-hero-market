"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ItemTable } from "@/components/item-table";
import { useT } from "@/lib/i18n/provider";
import { useMode } from "@/lib/mode/provider";
import type { ItemRow } from "@/lib/queries";

const KINDS = ["buy", "sell", "gainers", "losers", "volume", "expensive", "rare", "favorites"] as const;

export function RankingsView() {
  const { t } = useT();
  const mode = useMode();
  const sp = useSearchParams();
  // ?kind が無ければ現在のモード(購入→buy / 販売→sell)を初期選択
  const initial = sp.get("kind") ?? (mode === "sell" ? "sell" : "buy");
  const [kind, setKind] = useState<string>(KINDS.includes((initial as any)) ? initial : "buy");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/rankings/${kind}?limit=100`)
      .then((r) => r.json())
      .then((d) => active && setItems(d.items ?? []))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [kind]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Button key={k} size="sm" variant={k === kind ? "default" : "outline"} onClick={() => setKind(k)}>
            {t(`rank.${k}`)}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t(`rankdesc.${kind}`)}</p>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <ItemTable items={items} rank emptyText={t("common.empty")} />
      )}
    </div>
  );
}
