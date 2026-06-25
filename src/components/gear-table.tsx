"use client";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";
import { ItemThumb, GradeBadge } from "@/components/domain";
import { ClassIcon } from "@/components/class-icon";
import { cn } from "@/lib/utils";
import type { GearRow } from "@/lib/queries";

// 表に出すステータス列 (攻撃系→防御系)
const COLS = [
  "attack_damage", "attack_speed", "critical_chance", "critical_damage",
  "cooldown_reduction", "armor", "max_hp", "hp_regen_per_sec",
];
const PARTS = ["MAIN_WEAPON", "SUB_WEAPON", "ARMOR", "HELMET", "GLOVES", "BOOTS", "AMULET", "RING", "BRACER", "EARRING"];
const CLASSES = ["KNIGHT", "SLAYER", "HUNTER", "RANGER", "SORCERER", "PRIEST"];
// 高レア順。index が小さいほど高レア → rank は大きく
const GRADES = ["COSMIC", "DIVINE", "CELESTIAL", "BEYOND", "ARCANA", "IMMORTAL", "LEGENDARY", "RARE", "UNCOMMON", "COMMON"];
const GRADE_RANK: Record<string, number> = Object.fromEntries(GRADES.map((g, i) => [g, GRADES.length - i]));

function fmtVal(s: { v: number | null; unit: string } | undefined): string {
  if (!s || s.v == null) return "·";
  const n = s.v / 100;
  const num = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return s.unit === "PCT" ? num + "%" : num;
}

// 特殊ステータス1件の数値表記 (範囲は min~max)
function fmtSpecialNum(vMin: number | null, vMax: number | null, unit: string): string {
  const one = (x: number) => {
    const n = x / 100;
    const num = Number.isInteger(n) ? String(n) : n.toFixed(1);
    return unit === "PCT" ? num + "%" : num;
  };
  if (vMin == null) return "";
  if (vMax != null && vMax !== vMin) return `${one(vMin)}~${one(vMax)}`;
  return one(vMin);
}

export function GearTable({ items }: { items: GearRow[] }) {
  const { t, f, s, sq } = useT();
  const { fmt } = useMoney();
  const [parts, setParts] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [onlySpecial, setOnlySpecial] = useState(false);
  const [group, setGroup] = useState(false);
  const [sort, setSort] = useState("level");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function clickSort(col: string) {
    if (sort === col) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setOrder(col === "name" || col === "level" ? "asc" : "desc");
    }
  }

  const filtered = items.filter(
    (it) =>
      (!parts.length || parts.includes(it.part)) &&
      (!classes.length || classes.includes(it.classType)) &&
      (!grades.length || grades.includes(it.grade)) &&
      (!onlySpecial || it.specials.length > 0),
  );

  const keyOf = (it: GearRow): number | string => {
    if (sort === "name") return it.name;
    if (sort === "level") return it.level ?? 0;
    if (sort === "price") return it.lowestPrice ?? -1;
    if (sort === "grade") return GRADE_RANK[it.grade] ?? 0;
    return it.stats[sort]?.v ?? -1;
  };
  const dir = order === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const x = keyOf(a), y = keyOf(b);
    return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * dir;
  });

  // 並び替え対象 (識別 + 各ステータス)
  const SORT_KEYS = ["level", "price", "grade", "name", ...COLS];
  const sortLabel = (k: string) =>
    k === "level" ? "Lv" : k === "price" ? t("common.price") : k === "grade" ? t("filter.grade") : k === "name" ? t("common.item") : s(k, k);

  // 1アイテム = 1カード (横スクロール無し・全ステータス折り返し表示)
  function Card({ it }: { it: GearRow }) {
    return (
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/items/${it.id}`} className="flex min-w-0 items-center gap-2">
            <ItemThumb src={it.imageUrl} alt={it.name} size={32} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium hover:underline">{it.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                <GradeBadge grade={it.grade} />
                <span>{f(it.part)}</span>
                {it.classType !== "NONE" && <ClassIcon classType={it.classType} size={14} />}
                {it.level != null && <span>Lv{it.level}</span>}
              </div>
            </div>
          </Link>
          <div className="shrink-0 text-right">
            <div className={cn("text-sm font-medium tabular", !it.listed && "text-muted-foreground")} title={!it.listed ? t("gear.lastTraded") : undefined}>{fmt(it.lowestPrice)}</div>
            {!it.listed && <div className="text-[10px] leading-tight text-amber-500/90">{t("gear.notListed")}</div>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {COLS.filter((k) => it.stats[k]?.v != null).map((k) => (
            <span key={k}>
              <span className="text-muted-foreground">{s(k, k)}</span>{" "}
              <span className={cn("font-medium tabular", sort === k && "text-primary")}>{fmtVal(it.stats[k])}</span>
            </span>
          ))}
        </div>
        {it.specials.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
            {it.specials.map((sp, i) => {
              const num = sp.unit !== "TEXT" ? fmtSpecialNum(sp.vMin, sp.vMax, sp.unit) : "";
              return <span key={i} className="text-primary">◆ {sq(sp.key, sp.label)}{num && <span className="ml-1 font-medium tabular">{num}</span>}</span>;
            })}
          </div>
        )}
      </div>
    );
  }

  // 部位で区切る (早見表)
  const byPart = new Map<string, GearRow[]>();
  if (group) {
    for (const it of filtered) {
      const arr = byPart.get(it.part) ?? [];
      arr.push(it);
      byPart.set(it.part, arr);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3">
        <ChipRow label={t("filter.parts")} items={PARTS} selected={parts} onToggle={(v) => toggle(parts, setParts, v)} label2={(v) => f(v)} />
        <ChipRow label={t("filter.class")} items={CLASSES} selected={classes} onToggle={(v) => toggle(classes, setClasses, v)} label2={(v) => f(v)} />
        <ChipRow label={t("filter.grade")} items={GRADES} selected={grades} onToggle={(v) => toggle(grades, setGrades, v)} label2={(v) => f(v)} />
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={onlySpecial} onChange={(e) => setOnlySpecial(e.target.checked)} /> {t("gear.onlySpecial")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} /> {t("gear.group")}
          </label>
        </div>
        {/* 並び替え */}
        <div className="mt-2 border-t pt-2">
          <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{t("gear.sortBy")}</div>
          <div className="flex flex-wrap gap-1.5">
            {SORT_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => clickSort(k)}
                className={cn("rounded-full border px-2 py-0.5 text-xs", sort === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent")}
              >
                {sortLabel(k)}{sort === k ? (order === "asc" ? " ▲" : " ▼") : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} {t("common.items")}</div>

      {group ? (
        PARTS.filter((p) => byPart.get(p)?.length).map((p) => {
          const arr = [...byPart.get(p)!].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || GRADE_RANK[b.grade] - GRADE_RANK[a.grade]);
          return (
            <div key={p}>
              <div className="mb-1 mt-3 text-sm font-bold">{f(p)} <span className="font-normal text-muted-foreground">({arr.length})</span></div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{arr.map((it) => <Card key={it.id} it={it} />)}</div>
            </div>
          );
        })
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{sorted.map((it) => <Card key={it.id} it={it} />)}</div>
      )}
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
