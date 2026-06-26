"use client";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";
import { GradeBadge } from "@/components/domain";
import { cn } from "@/lib/utils";
import type { Material, MaterialEffect } from "@/lib/materials";
import { materialImage } from "@/lib/materials";

const CATS = ["DECORATION", "ENGRAVING", "INSCRIPTION", "CRAFTING", "ANNIVERSARY", "SOULSTONE"];
const GRADES = ["COSMIC", "DIVINE", "CELESTIAL", "BEYOND", "ARCANA", "IMMORTAL", "LEGENDARY", "RARE", "UNCOMMON", "COMMON"];
const GRADE_RANK: Record<string, number> = Object.fromEntries(GRADES.map((g, i) => [g, GRADES.length - i]));
const TARGET_UI: Record<string, string> = { WEAPON: "weapon", ARMOR: "armor", ACCESSORY: "accessory" };
const TARGET_ORDER = ["WEAPON", "ARMOR", "ACCESSORY", "ANY"];


export function MaterialsTable({ items, linkMap = {}, priceMap = {} }: { items: Material[]; linkMap?: Record<string, string>; priceMap?: Record<string, number> }) {
  const { t, f, s, su } = useT();
  const { fmt } = useMoney();
  const [cats, setCats] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rarity" | "name" | "category">("category");

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const qn = q.trim().toLowerCase();
  const filtered = items.filter(
    (m) =>
      (!cats.length || cats.includes(m.category)) &&
      (!grades.length || grades.includes(m.rarity)) &&
      (!qn || m.name.toLowerCase().includes(qn)),
  );
  const catRank = (c: string) => CATS.indexOf(c);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "rarity") return (GRADE_RANK[b.rarity] ?? 0) - (GRADE_RANK[a.rarity] ?? 0) || a.name.localeCompare(b.name);
    // category: カテゴリ順 → レア度 → 名前
    return catRank(a.category) - catRank(b.category) || (GRADE_RANK[a.rarity] ?? 0) - (GRADE_RANK[b.rarity] ?? 0) || a.name.localeCompare(b.name);
  });

  function EffCell({ m }: { m: Material }) {
    // 記念コイン: 使用時の出力レアリティ分布 (手動データ)
    if (m.category === "ANNIVERSARY") {
      if (!m.coinOutput?.length) return <span className="text-xs text-muted-foreground">{t("mat.noEffect")}</span>;
      return (
        <div className="text-xs">
          <div className="mb-0.5 text-[10px] text-muted-foreground">{t("mat.coinOutput")}</div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {m.coinOutput.map((o, i) => (
              <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap">
                {GRADES.includes(o.rarity) ? <GradeBadge grade={o.rarity} /> : <span className="text-muted-foreground">{o.rarity}</span>}
                <span className="font-medium tabular text-primary">{o.pct != null ? `≈${o.pct}%` : (o.note ?? "—")}</span>
              </span>
            ))}
          </div>
          {m.coinNote && <div className="mt-0.5 text-[10px] text-muted-foreground">※ {m.coinNote}</div>}
        </div>
      );
    }
    // 製作素材: 使用レベル (手動データ)
    if (m.category === "CRAFTING") {
      return m.craftLevel
        ? <span className="whitespace-nowrap text-xs">{t("mat.useLevel")}: <span className="font-medium tabular text-primary">Lv {m.craftLevel}</span></span>
        : <span className="text-xs text-muted-foreground">{t("mat.noEffect")}</span>;
    }
    if (!m.effects.length) return <span className="text-xs text-muted-foreground">{t("mat.noEffect")}</span>;
    // 碑文: ランダム1つのプール
    if (m.category === "INSCRIPTION") {
      return (
        <div className="text-xs">
          <div className="mb-0.5 text-[10px] text-muted-foreground">{t("mat.randomPool")}</div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {m.effects.map((e, i) => (
              <span key={i} className="whitespace-nowrap">
                {s(e.statKey, e.label)} <span className="font-medium tabular text-primary">{e.value}</span>
              </span>
            ))}
          </div>
        </div>
      );
    }
    // 装飾/彫刻: 対象(武器/防具/アクセ)ごと
    const byT = new Map<string, MaterialEffect[]>();
    for (const e of m.effects) {
      const arr = byT.get(e.target) ?? [];
      arr.push(e);
      byT.set(e.target, arr);
    }
    return (
      <div className="flex flex-col gap-1 text-xs">
        {TARGET_ORDER.filter((tg) => byT.get(tg)?.length).map((tg) => (
          <div key={tg} className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
              {tg === "ANY" ? t("mat.target.any") : su(TARGET_UI[tg] ?? tg)}
            </span>
            {byT.get(tg)!.map((e, i) => (
              <span key={i} className="whitespace-nowrap">
                {e.tier ? <span className="text-[10px] text-muted-foreground">T{e.tier} </span> : null}
                {s(e.statKey, e.label)} <span className="font-medium tabular text-primary">{e.value}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3">
        <ChipRow label={t("filter.type")} items={CATS} selected={cats} onToggle={(v) => toggle(cats, setCats, v)} label2={(v) => f(v)} />
        <ChipRow label={t("filter.grade")} items={GRADES} selected={grades} onToggle={(v) => toggle(grades, setGrades, v)} label2={(v) => f(v)} />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common.item")}
            className="h-8 w-44 rounded-md border bg-background px-2 text-sm"
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {(["category", "rarity", "name"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={cn("rounded px-2 py-0.5", sort === k ? "bg-primary/15 text-primary" : "hover:bg-accent")}
              >
                {k === "category" ? t("filter.type") : k === "rarity" ? t("filter.grade") : t("common.item")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} {t("common.items")}</div>

      {/* 1素材 = 1カード (横スクロール無し) */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((m) => {
          const id = linkMap[m.slug];
          const head = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={materialImage(m)} alt={m.name} width={32} height={32} className="h-8 w-8 shrink-0 rounded [image-rendering:pixelated]" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("truncate text-sm font-medium", id && "hover:underline")}>{m.name}</span>
                  {m.unreleased && <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-500">{t("mat.unreleased")}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <GradeBadge grade={m.rarity} />
                  <span>{f(m.category)}</span>
                </div>
              </div>
            </>
          );
          return (
            <div key={m.slug} className={cn("rounded-lg border bg-card p-3", m.unreleased && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                {id ? (
                  <Link href={`/items/${id}`} className="flex min-w-0 items-center gap-2">{head}</Link>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">{head}</div>
                )}
                <div className="shrink-0 text-right text-xs tabular">
                  {(() => {
                    // ライブの最安値(DB)を優先。無ければビルド時のスナップショット価格。
                    const live = priceMap[m.slug];
                    const yen = live != null ? live : m.onMarket ? m.refPriceYen : null;
                    return yen != null ? fmt(yen) : <span className="text-muted-foreground">—</span>;
                  })()}
                </div>
              </div>
              <div className="mt-2"><EffCell m={m} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChipRow({ label, items, selected, onToggle, label2 }: { label: string; items: string[]; selected: string[]; onToggle: (v: string) => void; label2: (v: string) => string }) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => (
          <button
            key={v}
            onClick={() => onToggle(v)}
            className={cn("rounded-full border px-2 py-0.5 text-xs", selected.includes(v) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent")}
          >
            {label2(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
