import Image from "next/image";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn, formatBps } from "@/lib/utils";

// ライトテーマでも読めるよう、文字色は light=濃いめ / dark=明るめ。
const GRADE_STYLE: Record<string, string> = {
  COMMON: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
  UNCOMMON: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  RARE: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  LEGENDARY: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  ARCANA: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  IMMORTAL: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  BEYOND: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  DIVINE: "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30",
  CELESTIAL: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
  COSMIC: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30",
};
const GRADE_LABEL: Record<string, string> = {
  COMMON: "Common", UNCOMMON: "Uncommon", RARE: "Rare", LEGENDARY: "Legendary",
  ARCANA: "Arcana", IMMORTAL: "Immortal", BEYOND: "Beyond", DIVINE: "Divine",
  CELESTIAL: "Celestial", COSMIC: "Cosmic",
};

export function GradeBadge({ grade }: { grade: string }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold", GRADE_STYLE[grade] ?? GRADE_STYLE.COMMON)}>
      {GRADE_LABEL[grade] ?? grade}
    </span>
  );
}

export function PriceChange({ bps, className }: { bps: number | null | undefined; className?: string }) {
  if (bps == null) return <span className="text-muted-foreground">—</span>;
  const Icon = bps > 0 ? ArrowUp : bps < 0 ? ArrowDown : Minus;
  const color = bps > 0 ? "text-up" : bps < 0 ? "text-down" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular font-medium", color, className)}>
      <Icon className="h-3 w-3" />
      {formatBps(bps)}
    </span>
  );
}

const RISK_VARIANT: Record<string, string> = {
  DANGER: "bg-down/15 text-down",
  CAUTION: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  GOOD: "bg-up/15 text-up",
  PROMISING: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
};
const RISK_LABEL: Record<string, string> = {
  DANGER: "危険", CAUTION: "注意", GOOD: "良好", PROMISING: "有望",
};

export function ScoreBadge({ score, risk }: { score: number | null; risk?: string | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const r = risk ?? (score >= 80 ? "PROMISING" : score >= 60 ? "GOOD" : score >= 40 ? "CAUTION" : "DANGER");
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold tabular", RISK_VARIANT[r])}>
      {score}
      <span className="font-normal opacity-70">{RISK_LABEL[r]}</span>
    </span>
  );
}

const REC_STYLE: Record<string, string> = {
  S: "bg-amber-500 text-black",
  A: "bg-emerald-500 text-black",
  B: "bg-blue-500 text-white",
  C: "bg-slate-500 text-white",
};

export function RecBadge({ rec }: { rec: string | null }) {
  if (!rec) return null;
  return (
    <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded text-xs font-black", REC_STYLE[rec])}>
      {rec}
    </span>
  );
}

// 実ファセット (英語ラベル / i18n は別途 messages で対応)
const TYPE_LABEL: Record<string, string> = { GEAR: "Equipment", MATERIAL: "Materials" };
const PART_LABEL: Record<string, string> = {
  MAIN_WEAPON: "Main Weapon", SUB_WEAPON: "Sub Weapon", ARMOR: "Armor", HELMET: "Helmet",
  GLOVES: "Gloves", BOOTS: "Boots", AMULET: "Amulet", RING: "Ring", BRACER: "Bracer", EARRING: "Earring", NONE: "—",
};
const CLASS_LABEL: Record<string, string> = {
  KNIGHT: "Knight", SLAYER: "Slayer", HUNTER: "Hunter", RANGER: "Ranger", SORCERER: "Sorcerer", PRIEST: "Priest", NONE: "—",
};
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t;
export const partLabel = (p: string) => PART_LABEL[p] ?? p;
export const classLabel = (c: string) => CLASS_LABEL[c] ?? c;

export function ItemThumb({ src, alt, size = 40 }: { src?: string | null; alt: string; size?: number }) {
  // 画像が無い場合は頭文字のプレースホルダ
  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground"
        style={{ width: size, height: size }}
      >
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded bg-muted object-contain"
      style={{ width: size, height: size }}
    />
  );
}
