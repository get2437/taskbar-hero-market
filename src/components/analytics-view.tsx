"use client";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useT } from "@/lib/i18n/provider";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Gran, Bucket } from "@/lib/analytics";

const GRANS: Gran[] = ["hour", "day", "month", "year"];

export function AnalyticsView({ data }: { data: Record<Gran, Bucket[]> }) {
  const { t, locale } = useT();
  const [gran, setGran] = useState<Gran>("day");

  // 粒度に応じたバケット軸ラベルのロケール整形
  const labelFmt = useMemo(() => {
    const opt: Intl.DateTimeFormatOptions =
      gran === "hour" ? { hour: "numeric", hour12: false }
      : gran === "day" ? { month: "numeric", day: "numeric" }
      : gran === "month" ? { year: "numeric", month: "short" }
      : { year: "numeric" };
    return new Intl.DateTimeFormat(locale, opt);
  }, [gran, locale]);

  const series = data[gran] ?? [];
  const chart = series.map((b) => ({ label: labelFmt.format(new Date(b.bucket)), count: b.count, iso: b.bucket }));
  const total = series.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-4">
      {/* 粒度トグル */}
      <div className="flex flex-wrap gap-1.5">
        {GRANS.map((g) => (
          <button
            key={g}
            onClick={() => setGran(g)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              gran === g ? "border-primary bg-primary/15 font-semibold text-primary" : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {t(`analytics.per.${g}`)}
          </button>
        ))}
      </div>

      {/* 合計 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs text-muted-foreground">{t(`analytics.window.${gran}`)}</div>
        <div className="text-3xl font-bold tabular">{formatNumber(total)} <span className="text-base font-normal text-muted-foreground">{t("analytics.views")}</span></div>
      </div>

      {/* 棒グラフ */}
      <div className="rounded-lg border bg-card p-3">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={40} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(v: number) => [formatNumber(v), t("analytics.views")]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("analytics.note")}</p>
    </div>
  );
}
