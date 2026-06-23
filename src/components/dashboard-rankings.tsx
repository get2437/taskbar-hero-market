"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/misc";
import { ItemTable } from "@/components/item-table";
import { useT } from "@/lib/i18n/provider";
import type { ItemRow } from "@/lib/queries";

export function DashboardRankings({
  gainers,
  losers,
  volume,
  expensive,
  rare,
}: {
  gainers: ItemRow[];
  losers: ItemRow[];
  volume: ItemRow[];
  expensive: ItemRow[];
  rare: ItemRow[];
}) {
  const { t } = useT();
  const tabs: { value: string; key: string; items: ItemRow[] }[] = [
    { value: "gainers", key: "rank.gainers", items: gainers },
    { value: "losers", key: "rank.losers", items: losers },
    { value: "volume", key: "rank.volume", items: volume },
    { value: "expensive", key: "rank.expensive", items: expensive },
    { value: "rare", key: "rank.rare", items: rare },
  ];
  return (
    <Tabs defaultValue="gainers" className="space-y-3">
      <TabsList className="flex-wrap">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {t(tab.key)}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          <ItemTable items={tab.items} rank />
        </TabsContent>
      ))}
    </Tabs>
  );
}
