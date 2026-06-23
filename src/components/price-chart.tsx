"use client";
import { useEffect, useState } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { formatNumber } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";

const RANGES = ["24h", "7d", "30d", "90d", "all"] as const;

interface Point { t: number; price: number; quantity: number }

export function PriceChart({ itemId, forecast }: { itemId: string; forecast?: { f30: number | null } }) {
  const { t } = useT();
  const { fmt } = useMoney();
  const [range, setRange] = useState("30d");
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/items/${itemId}/history?range=${range}`)
      .then((r) => r.json())
      .then((d) => active && setPoints(d.points ?? []))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [itemId, range]);

  const data = points.map((p) => ({
    ...p,
    label: new Date(p.t).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
  }));

  return (
    <div className="space-y-3">
      <Tabs value={range} onValueChange={setRange}>
        <TabsList className="flex-wrap">
          {RANGES.map((v) => <TabsTrigger key={v} value={v}>{t(`range.${v}`)}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="h-72 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("common.empty")}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} minTickGap={24} />
              <YAxis
                yAxisId="price"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => fmt(v)}
                width={64}
                domain={["auto", "auto"]}
              />
              <YAxis yAxisId="vol" orientation="right" hide />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: any, name: any) =>
                  name === "price" ? [fmt(value as number), t("common.price")] : [formatNumber(value as number), t("score.volume")]
                }
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => (value === "price" ? t("chart.lowestListing") : t("score.volume"))}
              />
              <Bar yAxisId="vol" dataKey="quantity" fill="hsl(var(--muted-foreground))" opacity={0.4} />
              <Line yAxisId="price" type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      {forecast?.f30 != null && (
        <p className="text-xs text-muted-foreground">
          {t("chart.forecast30")}: <span className="font-semibold text-foreground tabular">{fmt(forecast.f30)}</span>
        </p>
      )}
    </div>
  );
}
