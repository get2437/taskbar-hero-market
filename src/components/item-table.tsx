"use client";
import Link from "next/link";
import type { ItemRow } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { GradeBadge, PriceChange, ScoreBadge, RecBadge, ItemThumb } from "@/components/domain";
import { ClassIcon } from "@/components/class-icon";
import { FavoriteButton } from "@/components/favorite-button";
import { useT } from "@/lib/i18n/provider";
import { useMoney } from "@/lib/money/provider";

interface Props {
  items: ItemRow[];
  rank?: boolean;       // 順位列を表示
  showScore?: boolean;
  emptyText?: string;
}

export function ItemTable({ items, rank = false, showScore = true, emptyText }: Props) {
  const { t, f } = useT();
  const { fmt } = useMoney();
  if (items.length === 0) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{emptyText ?? t("common.empty")}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {rank && <th className="w-10 px-3 py-2 text-right">#</th>}
            <th className="w-8 px-2 py-2"></th>
            <th className="px-3 py-2 text-left">{t("common.item")}</th>
            <th className="px-3 py-2 text-right">{t("common.price")}</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">{t("common.daily")}</th>
            <th className="hidden px-3 py-2 text-right md:table-cell">{t("common.d7")}</th>
            <th className="hidden px-3 py-2 text-right lg:table-cell">{t("common.d30")}</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">{t("common.qty")}</th>
            {showScore && <th className="px-3 py-2 text-right">{t("common.score")}</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} className="border-b transition-colors last:border-0 hover:bg-accent/40">
              {rank && <td className="px-3 py-2 text-right tabular text-muted-foreground">{i + 1}</td>}
              <td className="px-2 py-2">
                <FavoriteButton itemId={it.id} />
              </td>
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
                      {it.level != null && <span>Lv{it.level}</span>}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-medium tabular">{fmt(it.lowestPrice)}</td>
              <td className="hidden px-3 py-2 text-right sm:table-cell"><PriceChange bps={it.changePrev} /></td>
              <td className="hidden px-3 py-2 text-right md:table-cell"><PriceChange bps={it.change7d} /></td>
              <td className="hidden px-3 py-2 text-right lg:table-cell"><PriceChange bps={it.change30d} /></td>
              <td className="hidden px-3 py-2 text-right tabular text-muted-foreground sm:table-cell">{formatNumber(it.quantity)}</td>
              {showScore && (
                <td className="px-3 py-2 text-right">
                  <ScoreBadge score={it.investmentScore} risk={it.riskLevel} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
