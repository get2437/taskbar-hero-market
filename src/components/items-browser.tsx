"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, Scale, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ItemThumb, GradeBadge, PriceChange, ScoreBadge, RecBadge } from "@/components/domain";
import { ClassIcon } from "@/components/class-icon";
import { FavoriteButton } from "@/components/favorite-button";
import { formatNumber, cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";
import { STAT_KEYS, STAT_GROUP_ORDER, STAT_GROUP_OF, statGroupLabelKey } from "@/lib/i18n";
import type { ItemRow } from "@/lib/queries";

// 素材サブ分類 (フィルタ用)
const MATCATS = ["DECORATION", "ENGRAVING", "INSCRIPTION", "CRAFTING", "SOULSTONE"] as const;

// Steam appfilters(3678970) の実ファセット
const TYPES = [
  ["GEAR", "Equipment"], ["MATERIAL", "Materials"],
] as const;
const PARTS = [
  ["MAIN_WEAPON", "Main Weapon"], ["SUB_WEAPON", "Sub Weapon"], ["ARMOR", "Armor"], ["HELMET", "Helmet"],
  ["GLOVES", "Gloves"], ["BOOTS", "Boots"], ["AMULET", "Amulet"], ["RING", "Ring"], ["BRACER", "Bracer"], ["EARRING", "Earring"],
] as const;
const GRADES = [
  ["COSMIC", "Cosmic"], ["DIVINE", "Divine"], ["CELESTIAL", "Celestial"], ["BEYOND", "Beyond"], ["ARCANA", "Arcana"],
  ["IMMORTAL", "Immortal"], ["LEGENDARY", "Legendary"], ["RARE", "Rare"], ["UNCOMMON", "Uncommon"], ["COMMON", "Common"],
] as const;
const CLASSES = [
  ["KNIGHT", "Knight"], ["SLAYER", "Slayer"], ["HUNTER", "Hunter"], ["RANGER", "Ranger"], ["SORCERER", "Sorcerer"], ["PRIEST", "Priest"],
] as const;

// 一覧背景アート: 単一クラス=そのクラス / 特定コンボ=専用アート。クラス名をソート連結したキーで判定。
const CLASS_COMBOS = new Set(["priest+ranger", "ranger+sorcerer", "hunter+priest+ranger"]);
function classBgUrl(classes: string[]): string | null {
  const lc = classes.map((c) => c.toLowerCase());
  if (lc.length === 1) return `/classes/${lc[0]}-bg.jpg`;
  if (lc.length >= 2) {
    const key = [...lc].sort().join("+");
    if (CLASS_COMBOS.has(key)) return `/classes/combo-${key.replace(/\+/g, "-")}-bg.jpg`;
  }
  return null;
}

interface ListResponse {
  items: ItemRow[];
  total: number;
  page: number;
  totalPages: number;
}

interface CompareStatLine {
  kind: string;
  statKey: string;
  label: string;
  valueMin: number | null;
  valueMax: number | null;
  unit: string;
  tier: number | null;
  appliesTo: string;
}
interface CompareStatItem {
  id: string;
  name: string;
  grade: string;
  materialCategory: string;
  requiredLevel: number | null;
  latest: { lowestPrice: number | null } | null;
  statLines: CompareStatLine[];
}
function fmtStat(l: CompareStatLine): string {
  if (l.unit === "TEXT" || l.valueMin == null) return "—";
  const f = (v: number) => {
    const n = v / 100;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };
  let v = f(l.valueMin);
  if (l.valueMax != null) v += "〜" + f(l.valueMax);
  return l.unit === "PCT" ? v + "%" : v;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function ItemsBrowser() {
  const tr = useT();
  const { t, f, s, su } = tr;
  const { fmt } = useMoney();
  const sp = useSearchParams();
  // C: 詳細のステータスから飛んできたとき、URL の statKeys/matCategories を初期フィルタにする
  const initCsv = (key: string) => (sp.get(key) ? sp.get(key)!.split(",").filter(Boolean) : []);
  // 全フィルタを URL から初期化 (アイテム詳細→戻る でフィルタを保持するため)
  const [q, setQ] = useState(() => sp.get("q") ?? "");
  const debouncedQ = useDebounced(q, 300);
  const [types, setTypes] = useState<string[]>(() => initCsv("types"));
  const [parts, setParts] = useState<string[]>(() => initCsv("parts"));
  const [grades, setGrades] = useState<string[]>(() => initCsv("grades"));
  const [classes, setClasses] = useState<string[]>(() => initCsv("classes"));
  const [matcats, setMatcats] = useState<string[]>(() => initCsv("matCategories"));
  const [statKeys, setStatKeys] = useState<string[]>(() => initCsv("statKeys").filter((k) => STAT_KEYS.includes(k)));
  const [withUnique, setWithUnique] = useState(sp.get("withUnique") === "1");
  const [priceMin, setPriceMin] = useState(() => sp.get("priceMin") ?? "");
  const [priceMax, setPriceMax] = useState(() => sp.get("priceMax") ?? "");
  const [levelMin, setLevelMin] = useState(() => sp.get("levelMin") ?? "");
  const [levelMax, setLevelMax] = useState(() => sp.get("levelMax") ?? "");
  const [sort, setSort] = useState(() => sp.get("sort") ?? "quantity");
  const [order, setOrder] = useState(() => sp.get("order") ?? "desc");
  const [page, setPage] = useState(() => Number(sp.get("page")) || 1);
  const [filtersOpen, setFiltersOpen] = useState(false); // モバイルでフィルタ折りたたみ

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState<ItemRow[]>([]);
  const [cheapest, setCheapest] = useState<ItemRow | null>(null); // D: ステータス絞り込み時の最安
  const [compareStats, setCompareStats] = useState<CompareStatItem[]>([]); // E: 比較アイテムのステータス
  const [showCompareStats, setShowCompareStats] = useState(false);

  const toggleIn = (arr: string[], set: (v: string[]) => void, val: string) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
    setPage(1);
  };

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (types.length) p.set("types", types.join(","));
    if (parts.length) p.set("parts", parts.join(","));
    if (grades.length) p.set("grades", grades.join(","));
    if (classes.length) p.set("classes", classes.join(","));
    if (matcats.length) p.set("matCategories", matcats.join(","));
    if (statKeys.length) p.set("statKeys", statKeys.join(","));
    if (withUnique) p.set("withUnique", "1");
    if (priceMin) p.set("priceMin", priceMin);
    if (priceMax) p.set("priceMax", priceMax);
    if (levelMin) p.set("levelMin", levelMin);
    if (levelMax) p.set("levelMax", levelMax);
    p.set("sort", sort);
    p.set("order", order);
    p.set("page", String(page));
    p.set("pageSize", "24");
    return p.toString();
  }, [debouncedQ, types, parts, grades, classes, matcats, statKeys, withUnique, priceMin, priceMax, levelMin, levelMax, sort, order, page]);

  // フィルタ状態を URL に反映 (再フェッチはせず address bar だけ更新)。
  // → アイテム詳細へ遷移して「戻る」と、この URL に戻りフィルタが復元される。
  useEffect(() => {
    const p = new URLSearchParams(query);
    p.delete("pageSize");
    if (p.get("sort") === "quantity") p.delete("sort");
    if (p.get("order") === "desc") p.delete("order");
    if (p.get("page") === "1") p.delete("page");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/items?${query}`)
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  // D: ステータス絞り込み時、価格昇順1件で「最安アイテム」を取得 (現ページの並びに依存しない)
  useEffect(() => {
    if (!statKeys.length) {
      setCheapest(null);
      return;
    }
    let active = true;
    const p = new URLSearchParams(query);
    p.set("sort", "price");
    p.set("order", "asc");
    p.set("page", "1");
    p.set("pageSize", "1");
    fetch(`/api/items?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => active && setCheapest(d.items?.[0] ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [query, statKeys.length]);

  // E: 比較リストのステータスを取得 (2件以上 & 表示中のとき)
  useEffect(() => {
    if (!showCompareStats || compare.length < 2) {
      setCompareStats([]);
      return;
    }
    let active = true;
    fetch(`/api/items/compare?ids=${compare.map((c) => c.id).join(",")}`)
      .then((r) => r.json())
      .then((d) => active && setCompareStats(d.items ?? []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [compare, showCompareStats]);

  const toggleCompare = useCallback((it: ItemRow) => {
    setCompare((cur) =>
      cur.find((c) => c.id === it.id) ? cur.filter((c) => c.id !== it.id) : cur.length >= 8 ? cur : [...cur, it],
    );
  }, []);

  const resetFilters = () => {
    setTypes([]); setParts([]); setGrades([]); setClasses([]);
    setMatcats([]); setStatKeys([]); setWithUnique(false);
    setPriceMin(""); setPriceMax(""); setLevelMin(""); setLevelMax(""); setQ(""); setPage(1);
  };

  const compareTotal = compare.reduce((a, c) => a + (c.lowestPrice ?? 0), 0);
  const compareAvg = compare.length ? Math.round(compareTotal / compare.length) : 0;

  const activeFilterCount =
    types.length + parts.length + grades.length + classes.length +
    matcats.length + statKeys.length + (withUnique ? 1 : 0) +
    (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (levelMin ? 1 : 0) + (levelMax ? 1 : 0);

  // クラスを1つだけ選択中なら、一覧にそのクラスの背景アートを敷く (情報は透過スクリムで可読維持)
  // 単一クラス=そのアート / 特定コンボ=専用アート / それ以外の複数選択=背景なし
  const bgUrl = classBgUrl(classes);
  const bgActive = !!bgUrl;
  // padding は付けない (クラス選択で一覧がずれないように)。下地は黒・薄めのスクリム。
  const listBgStyle: React.CSSProperties | undefined = bgUrl
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,.40), rgba(0,0,0,.58)), url(${bgUrl})`,
        backgroundRepeat: "no-repeat, no-repeat",
        // 画像は contain で全体表示 (単一・コンボとも見切れないように)。スクリムは cover。
        backgroundSize: "cover, contain",
        backgroundPosition: "center, center top",
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* フィルタ */}
      <aside className="lg:w-64 lg:shrink-0">
        {/* モバイル/タブレット: フィルタ開閉トグル (lg以上は常時表示) */}
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="mb-2 flex w-full items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm font-semibold lg:hidden"
          aria-expanded={filtersOpen}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {t("filter.title")}
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{activeFilterCount}</span>
            )}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
        </button>
        <Card className={cn(filtersOpen ? "block" : "hidden", "lg:block")}>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t("filter.title")}</span>
              <button onClick={resetFilters} className="text-xs text-muted-foreground hover:underline">{t("filter.reset")}</button>
            </div>

            <FilterGroup label={t("filter.type")}>
              {TYPES.map(([v]) => (
                <CheckRow key={v} checked={types.includes(v)} onChange={() => toggleIn(types, setTypes, v)} label={f(v)} />
              ))}
            </FilterGroup>
            <FilterGroup label={t("filter.parts")}>
              {PARTS.map(([v]) => (
                <CheckRow key={v} checked={parts.includes(v)} onChange={() => toggleIn(parts, setParts, v)} label={f(v)} />
              ))}
            </FilterGroup>
            <FilterGroup label={t("filter.grade")}>
              {GRADES.map(([v]) => (
                <CheckRow key={v} checked={grades.includes(v)} onChange={() => toggleIn(grades, setGrades, v)} label={f(v)} />
              ))}
            </FilterGroup>
            <FilterGroup label={t("filter.class")}>
              {CLASSES.map(([v]) => (
                <CheckRow key={v} checked={classes.includes(v)} onChange={() => toggleIn(classes, setClasses, v)} label={f(v)} icon={<ClassIcon classType={v} size={18} />} />
              ))}
            </FilterGroup>
            <FilterGroup label={t("common.price")}>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="min" value={priceMin} onChange={(e) => { setPriceMin(e.target.value); setPage(1); }} />
                <span className="text-muted-foreground">〜</span>
                <Input type="number" placeholder="max" value={priceMax} onChange={(e) => { setPriceMax(e.target.value); setPage(1); }} />
              </div>
            </FilterGroup>
            <FilterGroup label={t("filter.level")}>
              <div className="flex items-center gap-2">
                <Input type="number" placeholder="Lv min" value={levelMin} onChange={(e) => { setLevelMin(e.target.value); setPage(1); }} />
                <span className="text-muted-foreground">〜</span>
                <Input type="number" placeholder="Lv max" value={levelMax} onChange={(e) => { setLevelMax(e.target.value); setPage(1); }} />
              </div>
            </FilterGroup>
            <FilterGroup label={su("materialType")}>
              {MATCATS.map((v) => (
                <CheckRow key={v} checked={matcats.includes(v)} onChange={() => toggleIn(matcats, setMatcats, v)} label={f(v)} />
              ))}
            </FilterGroup>
            <details className="stat-section">
              <summary>
                <span>
                  {su("stats")} <span className="font-normal text-muted-foreground">({STAT_KEYS.length})</span>
                  {statKeys.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">{statKeys.length}</span>
                  )}
                </span>
              </summary>
              <div className="stat-section-body">
                <div className="max-h-60 space-y-1.5 overflow-auto pr-1">
                  {STAT_GROUP_ORDER.map((g) => {
                    const keys = STAT_KEYS.filter((k) => STAT_GROUP_OF[k] === g);
                    if (!keys.length) return null;
                    return (
                      <div key={g}>
                        <div className="mb-1 text-[10px] uppercase opacity-60">{su(statGroupLabelKey(g))}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {keys.map((k) => (
                            <Chip key={k} active={statKeys.includes(k)} onClick={() => toggleIn(statKeys, setStatKeys, k)} label={s(k, k)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
            <FilterGroup label={su("special")}>
              <CheckRow checked={withUnique} onChange={() => { setWithUnique((v) => !v); setPage(1); }} label={su("hasSpecial")} />
            </FilterGroup>
          </CardContent>
        </Card>
      </aside>

      {/* 一覧 */}
      <div className={`min-w-0 flex-1 space-y-3 ${bgActive ? "rounded-lg" : ""}`} style={listBgStyle}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder={t("common.search")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto">
              <option value="quantity">{t("sort.quantity")}</option>
              <option value="price">{t("sort.price")}</option>
              <option value="level">{t("sort.level")}</option>
              <option value="name">{t("sort.name")}</option>
              <option value="score">{t("sort.score")}</option>
              <option value="change7d">{t("sort.change7d")}</option>
            </Select>
            <Select value={order} onChange={(e) => setOrder(e.target.value)} className="w-auto">
              <option value="desc">{t("common.desc")}</option>
              <option value="asc">{t("common.asc")}</option>
            </Select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {data ? `${formatNumber(data.total)} ${t("common.items")}` : ""}
        </div>

        {/* D: ステータス絞り込み時、最安アイテムを提示 */}
        {statKeys.length > 0 && cheapest && (
          <Link
            href={`/items/${cheapest.id}`}
            className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm hover:bg-primary/15"
          >
            <span className="text-[11px] text-muted-foreground">{su("cheapest")}</span>
            <b className="truncate">{cheapest.name}</b>
            <span className="ml-auto font-bold text-primary tabular">{fmt(cheapest.lowestPrice)}</span>
          </Link>
        )}

        {loading && !data ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : (
          <div className={`overflow-x-auto rounded-lg border ${bgActive ? "border-white/10 bg-black/25 backdrop-blur-sm" : ""}`}>
            <table className="w-full text-sm">
              <thead className={`border-b text-xs text-muted-foreground ${bgActive ? "bg-black/35" : "bg-muted/40"}`}>
                <tr>
                  <th className="w-8 px-2 py-2" title={t("common.compare")}><Scale className="h-3.5 w-3.5" /></th>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-3 py-2 text-left">{t("common.item")}</th>
                  <th className="px-3 py-2 text-right">{t("common.price")}</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">{t("common.daily")}</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">{t("common.d7")}</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">{t("common.median")}</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">{t("common.qty")}</th>
                  <th className="px-3 py-2 text-right">{t("common.score")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((it) => (
                  <tr key={it.id} className="border-b transition-colors last:border-0 hover:bg-accent/40">
                    <td className="px-2 py-2">
                      <Checkbox checked={!!compare.find((c) => c.id === it.id)} onCheckedChange={() => toggleCompare(it)} />
                    </td>
                    <td className="px-2 py-2"><FavoriteButton itemId={it.id} /></td>
                    <td className="px-3 py-2">
                      <Link href={`/items/${it.id}`} className="flex items-center gap-2">
                        <ItemThumb src={it.imageUrl} alt={it.name} size={32} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium hover:underline">{it.name}</span>
                            <RecBadge rec={it.recommendation} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <GradeBadge grade={it.grade} />
                            <span>{f(it.type)}</span>
                            {it.classType !== "NONE" && <ClassIcon classType={it.classType} size={14} className="opacity-90" />}
                            <span>Lv{it.level}</span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular">{fmt(it.lowestPrice)}</td>
                    <td className="hidden px-3 py-2 text-right sm:table-cell"><PriceChange bps={it.changePrev} /></td>
                    <td className="hidden px-3 py-2 text-right md:table-cell"><PriceChange bps={it.change7d} /></td>
                    <td className="hidden px-3 py-2 text-right tabular text-muted-foreground md:table-cell">{fmt(it.medianPrice)}</td>
                    <td className="hidden px-3 py-2 text-right tabular text-muted-foreground sm:table-cell">{formatNumber(it.quantity)}</td>
                    <td className="px-3 py-2 text-right"><ScoreBadge score={it.investmentScore} risk={it.riskLevel} /></td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">{t("common.empty")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common.prev")}</Button>
            <span className="text-sm tabular text-muted-foreground">{page} / {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</Button>
          </div>
        )}
      </div>

      {/* 比較バー */}
      {compare.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-5xl space-y-2">
            {/* E: ステータス比較テーブル */}
            {showCompareStats && compareStats.length >= 2 && (
              <div className="max-h-64 overflow-auto rounded-lg border">
                <StatCompareTable items={compareStats} tr={tr} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <Scale className="h-4 w-4" /> {su("compare")} ({compare.length})
              </div>
              <div className="flex flex-1 flex-wrap gap-1">
                {compare.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
                    {c.name}
                    <button onClick={() => toggleCompare(c)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-sm tabular">
                <span>{t("common.total")} <b>{fmt(compareTotal)}</b></span>
                <span>{t("common.average")} <b>{fmt(compareAvg)}</b></span>
                {compare.length >= 2 && (
                  <Button size="sm" variant={showCompareStats ? "default" : "outline"} onClick={() => setShowCompareStats((v) => !v)}>
                    {su("stats")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setCompare([]); setShowCompareStats(false); }}>{t("filter.reset")}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckRow({ checked, onChange, label, icon }: { checked: boolean; onChange: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {icon}
      {label}
    </label>
  );
}
// E: 比較アイテムのステータスを表で並べる (行=ステータス, 列=アイテム)。基礎+固有を対象。
function StatCompareTable({ items, tr }: { items: CompareStatItem[]; tr: ReturnType<typeof useT> }) {
  // 列ごとに statKey -> 行 を引けるようにする
  const maps = items.map((it) => {
    const m = new Map<string, CompareStatLine>();
    for (const l of it.statLines) if ((l.kind === "BASE" || l.kind === "INHERENT") && !m.has(l.statKey)) m.set(l.statKey, l);
    return m;
  });
  // 出現する全ステータスキーをグループ順に並べる
  const present = new Set<string>();
  maps.forEach((m) => m.forEach((_, k) => present.add(k)));
  const ordered = STAT_KEYS.filter((k) => present.has(k));
  if (!ordered.length) return <div className="p-3 text-center text-xs text-muted-foreground">{tr.t("common.empty")}</div>;
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-muted/60">
        <tr>
          <th className="px-2 py-1.5 text-left font-medium">{tr.su("stats")}</th>
          {items.map((it) => (
            <th key={it.id} className="max-w-[7rem] truncate px-2 py-1.5 text-right font-medium" title={it.name}>{it.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ordered.map((k) => {
          // ハイライト用に各列の数値(valueMin)を比較
          const vals = maps.map((m) => m.get(k)?.valueMin ?? null);
          const max = Math.max(...vals.filter((v): v is number => v != null));
          return (
            <tr key={k} className="border-t">
              <td className="px-2 py-1 text-muted-foreground">{tr.s(k, k)}</td>
              {maps.map((m, i) => {
                const l = m.get(k);
                const best = l?.valueMin != null && l.valueMin === max && vals.filter((v) => v != null).length > 1;
                return (
                  <td key={i} className={cn("px-2 py-1 text-right tabular", best ? "font-bold text-primary" : "")}>
                    {l ? fmtStat(l) : "—"}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs transition-colors",
        active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}
