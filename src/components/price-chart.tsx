"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { formatNumber } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";

const RANGES = ["24h", "7d", "30d", "90d", "all"] as const;
type Range = (typeof RANGES)[number];

const HOUR = 3_600_000;
const DAY = 86_400_000;

interface Point { t: number; price: number; quantity: number }

// 各レンジの「現在から遡る幅」と目盛り。24時間は時刻、それ以外は日付で表示する。
const RANGE_SPAN: Record<Range, number | null> = {
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
  all: null,
};

/** end(=現在) から start まで step 間隔で遡った目盛りを返す（必ず end を含む=今日/現在を含む）。 */
function buildTicks(start: number, end: number, step: number): number[] {
  const ticks: number[] = [];
  for (let tk = end; tk >= start - 1; tk -= step) ticks.unshift(tk);
  return ticks;
}

export function PriceChart({ itemId, forecast }: { itemId: string; forecast?: { f30: number | null } }) {
  const { t } = useT();
  const { fmt } = useMoney();
  const [range, setRange] = useState<Range>("30d");
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

  // X軸はデータ点ではなく「現在から遡る時間軸」。レンジに応じて目盛りと書式を決める。
  const { domain, ticks, isHour } = useMemo(() => {
    const end = Date.now();
    const span = RANGE_SPAN[range];
    if (range === "24h") {
      const start = end - DAY;
      const lastHour = Math.floor(end / HOUR) * HOUR; // 目盛りは正時に揃える (08:00 等)
      return { domain: [start, end] as [number, number], ticks: buildTicks(start, lastHour, 4 * HOUR), isHour: true };
    }
    if (span != null) {
      const start = end - span;
      const stepDays = range === "7d" ? 1 : range === "30d" ? 5 : 15; // 90d
      return { domain: [start, end] as [number, number], ticks: buildTicks(start, end, stepDays * DAY), isHour: false };
    }
    // all: データの最古〜現在を6分割
    const minT = points.length ? Math.min(...points.map((p) => p.t)) : end - 30 * DAY;
    const start = Math.min(minT, end);
    const step = Math.max(DAY, Math.round((end - start) / 6));
    return { domain: [start, end] as [number, number], ticks: buildTicks(start, end, step), isHour: false };
  }, [range, points]);

  const fmtTick = (v: number) => {
    const d = new Date(v);
    return isHour
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
  };
  const fmtFull = (v: number) => {
    const d = new Date(v);
    return isHour
      ? d.toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });
  };

  // ドメイン内のデータだけ描画（範囲外の古い点で軸が伸びないように）
  const data = useMemo(
    () => points.filter((p) => p.t >= domain[0] && p.t <= domain[1]).sort((a, b) => a.t - b.t),
    [points, domain],
  );

  return (
    <div className="space-y-3">
      <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
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
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={domain}
                ticks={ticks}
                tickFormatter={fmtTick}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                minTickGap={16}
              />
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
                labelFormatter={(v) => fmtFull(v as number)}
                formatter={(value: any, name: any) =>
                  name === "price" ? [fmt(value as number), t("common.price")] : [formatNumber(value as number), t("chart.listings")]
                }
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => (value === "price" ? t("chart.lowestListing") : t("chart.listings"))}
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
