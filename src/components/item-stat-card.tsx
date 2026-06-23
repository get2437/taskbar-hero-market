import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Translator } from "@/lib/i18n";

// 説明文由来のステータス行 (ItemStatLine をシリアライズしたもの)。値は ×100 整数。
export interface StatLineView {
  kind: string;
  statKey: string;
  label: string;
  valueMin: number | null;
  valueMax: number | null;
  unit: string;
  tier: number | null;
  appliesTo: string;
  rawText: string;
}

export interface StatItemView {
  materialCategory: string;
  requiredLevel: number | null;
  decoSlots: number | null;
  engraveSlots: number | null;
  inscriptSlots: number | null;
  statLines: StatLineView[];
}

function fmt(v: number): string {
  const n = v / 100;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function fmtVal(l: StatLineView): string {
  if (l.unit === "TEXT" || l.valueMin == null) return "";
  let v = fmt(l.valueMin);
  if (l.valueMax != null) v += "〜" + fmt(l.valueMax);
  return l.unit === "PCT" ? v + "%" : v;
}

const TARGET_UI: Record<string, string> = { WEAPON: "weapon", ARMOR: "armor", ACCESSORY: "accessory" };

function StatRow({ l, tr, plus }: { l: StatLineView; tr: Translator; plus?: boolean }) {
  const label = tr.s(l.statKey, l.label);
  const clickable = l.statKey && l.unit !== "TEXT";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-1 text-sm">
      <span className="text-muted-foreground">
        {l.tier ? <span className="mr-1 text-[10px] font-bold text-primary">[T{l.tier}]</span> : null}
        {clickable ? (
          <Link href={`/?statKeys=${l.statKey}`} title={tr.su("viewItemsWith")} className="border-b border-dotted border-current hover:text-primary">
            {label}
          </Link>
        ) : (
          label
        )}
      </span>
      <span className="font-semibold tabular">{(plus ? "+" : "") + fmtVal(l)}</span>
    </div>
  );
}

// 折りたたみセクション: 既定=展開 (open)。「−」で折りたたみ可。サーバ側で完結 (details/summary)。
function CollapsibleSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="stat-section" open>
      <summary>
        <span>
          {title}
          {count != null ? <span className="ml-1 font-normal text-muted-foreground">({count})</span> : null}
        </span>
      </summary>
      <div className="stat-section-body">{children}</div>
    </details>
  );
}

function Section({ title, rows, tr, plus }: { title: string; rows: StatLineView[]; tr: Translator; plus?: boolean }) {
  if (!rows.length) return null;
  return (
    <CollapsibleSection title={title} count={rows.length}>
      {rows.map((l, i) => (
        <StatRow key={i} l={l} tr={tr} plus={plus} />
      ))}
    </CollapsibleSection>
  );
}

/** アイテム詳細のステータスカード (Steam 説明文由来)。データが無ければ null。 */
export function ItemStatCard({ item, tr }: { item: StatItemView; tr: Translator }) {
  const sl = item.statLines ?? [];
  const base = sl.filter((l) => l.kind === "BASE");
  const inherent = sl.filter((l) => l.kind === "INHERENT");
  const unique = sl.filter((l) => l.kind === "SPECIAL");
  const effects = sl.filter((l) => l.kind === "MATERIAL_EFFECT");

  const badges: string[] = [];
  if (item.requiredLevel != null) badges.push(`${tr.su("requiredLv")} ${item.requiredLevel}`);
  if (item.decoSlots) badges.push(`${tr.su("decoration")} ×${item.decoSlots}`);
  if (item.engraveSlots) badges.push(`${tr.su("engraving")} ×${item.engraveSlots}`);
  if (item.inscriptSlots) badges.push(`${tr.su("inscription")} ×${item.inscriptSlots}`);

  if (!badges.length && !base.length && !inherent.length && !unique.length && !effects.length) return null;

  // 素材付与効果を対象別にグループ化
  const byTarget = new Map<string, StatLineView[]>();
  for (const e of effects) {
    const arr = byTarget.get(e.appliesTo) ?? [];
    arr.push(e);
    byTarget.set(e.appliesTo, arr);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{tr.su("stats")}</CardTitle>
        <span className="text-[11px] text-muted-foreground">{tr.su("steamDesc")}</span>
      </CardHeader>
      <CardContent>
        {badges.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {badges.map((b, i) => (
              <span key={i} className="rounded bg-muted/60 px-2 py-0.5 text-[11px]">{b}</span>
            ))}
          </div>
        )}
        <Section title={tr.su("baseStats")} rows={base} tr={tr} />
        <Section title={tr.su("inherentStats")} rows={inherent} tr={tr} />
        {unique.length > 0 && (
          <CollapsibleSection title={tr.su("specialStats")} count={unique.length}>
            {unique.map((u, i) => (
              <div key={i} className="py-1 text-sm text-primary">◆ {tr.sq(u.statKey, u.label)}</div>
            ))}
          </CollapsibleSection>
        )}
        {effects.length > 0 && (
          <CollapsibleSection title={tr.su("grantedEffects")} count={effects.length}>
            {(item.materialCategory === "DECORATION" || item.materialCategory === "ENGRAVING" || item.materialCategory === "INSCRIPTION") && (
              <div className="mb-1.5 text-[11px] text-primary">
                ℹ {tr.su(item.materialCategory === "DECORATION" ? "grantAll" : "grantRandom")}
              </div>
            )}
            {[...byTarget.entries()].map(([target, rows], gi) => (
              <div key={gi} className="mb-1.5">
                {target !== "NONE" && (
                  <div className="mb-0.5 text-[11px] text-muted-foreground">{tr.su(TARGET_UI[target] ?? target)}</div>
                )}
                {rows.map((l, i) => (
                  <StatRow key={i} l={l} tr={tr} plus />
                ))}
              </div>
            ))}
          </CollapsibleSection>
        )}
      </CardContent>
    </Card>
  );
}
