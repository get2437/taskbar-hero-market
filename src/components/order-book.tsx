"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { useT } from "@/lib/i18n/provider";
import { useMode } from "@/lib/mode/provider";
import { useLive } from "@/lib/use-live";
import { formatNumber, cn } from "@/lib/utils";
import { useMoney } from "@/lib/money/provider";

interface Row { price: number; qty: number; note: "more" | "less" | "" }
interface Book { sell: Row[]; buy: Row[]; sellCount: number; buyCount: number }

export function OrderBook({ itemId, hash }: { itemId: string; hash: string }) {
  const { t } = useT();
  const { fmt } = useMoney();
  const mode = useMode();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  // SSE: 自分の銘柄の注文板更新を即反映
  useLive((ev) => {
    if (ev?.type === "orderbook" && ev.hash === hash && ev.book) setBook(ev.book);
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = () =>
      fetch(`/api/items/${itemId}/orderbook`)
        .then((r) => r.json())
        .then((d) => active && setBook(d))
        .catch(() => {})
        .finally(() => active && setLoading(false));
    load();
    // SSEが切れている場合のフォールバック (閲覧継続=ホット維持も兼ねる)
    const poll = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [itemId]);

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!book || ((book.sell?.length ?? 0) === 0 && (book.buy?.length ?? 0) === 0)) return null;

  const rows = (list: Row[], side: "sell" | "buy") =>
    list.length === 0 ? (
      <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">—</td></tr>
    ) : (
      list.map((r, i) => (
        <tr key={i} className="border-t">
          <td className={cn("px-3 py-1.5 tabular", side === "sell" ? "text-up" : "text-down")}>
            {fmt(r.price)}
            {r.note === "more" && <span className="ml-1 text-xs text-muted-foreground">{t("ob.more")}</span>}
            {r.note === "less" && <span className="ml-1 text-xs text-muted-foreground">{t("ob.less")}</span>}
          </td>
          <td className="px-3 py-1.5 text-right tabular text-muted-foreground">{formatNumber(r.qty)}</td>
        </tr>
      ))
    );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("ob.title")}</CardTitle>
        <span className="text-xs text-muted-foreground">{t("ob.live")}</span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {(() => {
            const sellPanel = (
              <div key="sell" className={cn("rounded-lg", mode === "buy" && "border border-up/40 p-2")}>
                <div className="mb-1 text-xs font-semibold text-up">
                  {t("ob.sell")}{mode === "buy" && <span className="ml-1">← {t("mode.youPay")}</span>}{" "}
                  <span className="font-normal text-muted-foreground">· {fmt(book.sell?.[0]?.price)} · {formatNumber(book.sellCount)}</span>
                </div>
                <table className="w-full overflow-hidden rounded-md border text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr><th className="px-3 py-1.5 text-left">{t("common.price")}</th><th className="px-3 py-1.5 text-right">{t("common.qty")}</th></tr>
                  </thead>
                  <tbody>{rows(book.sell ?? [], "sell")}</tbody>
                </table>
              </div>
            );
            const buyPanel = (
              <div key="buy" className={cn("rounded-lg", mode === "sell" && "border border-down/40 p-2")}>
                <div className="mb-1 text-xs font-semibold text-down">
                  {t("ob.buy")}{mode === "sell" && <span className="ml-1">← {t("mode.youGet")}</span>}{" "}
                  <span className="font-normal text-muted-foreground">· {fmt(book.buy?.[0]?.price)} · {formatNumber(book.buyCount)}</span>
                </div>
                <table className="w-full overflow-hidden rounded-md border text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr><th className="px-3 py-1.5 text-left">{t("common.price")}</th><th className="px-3 py-1.5 text-right">{t("common.qty")}</th></tr>
                  </thead>
                  <tbody>{rows(book.buy ?? [], "buy")}</tbody>
                </table>
              </div>
            );
            return mode === "buy" ? [sellPanel, buyPanel] : [buyPanel, sellPanel];
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
