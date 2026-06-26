import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { getItemDetail, getRecentTrades, getRelatedItems } from "@/lib/queries";
import { getCurrentUserId } from "@/lib/session";
import { isFavorited } from "@/lib/favorites";
import { getOrderBook } from "@/lib/steam/orderbook";
import { getTranslator } from "@/lib/i18n/server";
import { getMode } from "@/lib/mode/server";
import { ClassIcon } from "@/components/class-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceChart } from "@/components/price-chart";
import { FavoriteButton } from "@/components/favorite-button";
import { ModeSelector } from "@/components/mode-selector";
import { ShareButton } from "@/components/share-button";
import { AlertForm } from "@/components/alert-form";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { OrderBook } from "@/components/order-book";
import { ItemStatCard } from "@/components/item-stat-card";
import { ItemTable } from "@/components/item-table";
import { LiveRefresh } from "@/components/live-refresh";
import { AdInContent } from "@/components/ads";
import { GradeBadge, PriceChange, RecBadge, ItemThumb } from "@/components/domain";
import { formatNumber, formatDateTime, formatBps, cn, priceParts, safeJsonLd } from "@/lib/utils";
import { getMoney } from "@/lib/money/server";

const STEAM_APP_ID = Number(process.env.NEXT_PUBLIC_STEAM_APP_ID ?? process.env.STEAM_APP_ID ?? 3678970);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<import("next").Metadata> {
  const { id } = await params;
  const item = await getItemDetail(id).catch(() => null);
  if (!item) return { title: "Item not found" };
  const money = await getMoney();
  const price = item.latest?.lowestPrice != null ? ` — ${money.fmt(item.latest.lowestPrice)}` : "";
  return {
    title: `${item.name}${price}`,
    description: `${item.name} — Steam Market price, order book, charts and investment analysis for Taskbar Hero.`,
    alternates: { canonical: `/items/${id}` },
    // images は指定しない → opengraph-image.tsx が自動で使われる (大きな価格入りOG)
    openGraph: { title: item.name },
  };
}

// 色のみ参照（表示テキストは t(`trend.${...}`) で多言語化）。
const TREND_COLOR: Record<string, string> = {
  UP: "text-up",
  DOWN: "text-down",
  FLAT: "text-muted-foreground",
};

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemDetail(id);
  if (!item) notFound();
  const [trades, userId] = await Promise.all([getRecentTrades(id, 30), getCurrentUserId()]);
  const favorited = await isFavorited(userId, id);

  const tr = await getTranslator();
  const { t, f } = tr;
  const money = await getMoney();
  const mode = await getMode();
  const a = item.analysis;
  const l = item.latest;
  const trendColor = a?.trend ? TREND_COLOR[a.trend] : null;
  const steamUrl = `https://steamcommunity.com/market/listings/${STEAM_APP_ID}/${encodeURIComponent(item.marketHashName)}`;

  // 注文板(LIVE)から実際の最安/最高/最高買取を取得 (Redis 60秒キャッシュ)
  const book = await getOrderBook(item.marketHashName).catch(() => null);
  const lowestAsk = book?.sell?.[0]?.price ?? l?.lowestPrice ?? null;
  // 最高出品価格は注文板(実データ)からのみ。検索取得には最高値が無いので、無ければ — 表示。
  const highestAsk = book?.sell?.length ? Math.max(...book.sell.map((r) => r.price)) : (l?.highestPrice ?? null);
  const highestBid = book?.buy?.[0]?.price ?? null;
  const related = await getRelatedItems(item).catch(() => []);

  // 構造化データ (JSON-LD): Product + Offer。検索エンジンのリッチ表示用。
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    image: item.imageUrl ?? undefined,
    category: item.grade,
    url: site ? `${site}/items/${id}` : undefined,
    ...(lowestAsk != null
      ? {
          offers: {
            "@type": "Offer",
            price: priceParts(lowestAsk).amount,
            priceCurrency: priceParts(lowestAsk).currency,
            availability: (l?.quantity ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: site ? `${site}/items/${id}` : undefined,
          },
        }
      : {}),
  };

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(productLd) }} />
      <BackButton
        label={t("detail.back")}
        className="sticky top-[64px] z-20 inline-flex w-fit cursor-pointer items-center gap-1.5 self-start rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold shadow-md hover:bg-accent hover:border-primary"
      />

      {/* ヘッダ */}
      <div className="flex flex-wrap items-start gap-4">
        <ItemThumb src={item.imageUrl} alt={item.name} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{item.name}</h1>
            <RecBadge rec={a?.recommendation ?? null} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <GradeBadge grade={item.grade} />
            <span>{f(item.type)}</span>
            {item.part !== "NONE" && <span>{t("detail.part")}: {f(item.part)}</span>}
            {item.classType !== "NONE" && (
              <span className="inline-flex items-center gap-1">
                <ClassIcon classType={item.classType} size={18} />
                {t("detail.class")}: {f(item.classType)}
              </span>
            )}
            {item.level != null && <span>Lv{item.level}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ModeSelector />
          <div className="flex items-center gap-2">
            <ShareButton title={item.name} text={`${item.name} | Taskbar Hero Market`} />
            <FavoriteButton itemId={item.id} initial={favorited} size={24} />
          </div>
          <a
            href={steamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs text-primary hover:bg-accent"
          >
            {t("detail.viewOnSteam")} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* マーケット情報 (最安/最高/最高買取は注文板の実データ。モードで行動価格を強調) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label={t("detail.lowest")} value={money.fmt(lowestAsk)} big={mode === "buy"} hint={mode === "buy" ? t("mode.youPay") : undefined} />
        <Metric label={t("detail.highest")} value={money.fmt(highestAsk)} />
        <Metric label={t("detail.median")} value={money.fmt(l?.medianPrice)} />
        <Metric label={t("detail.highestBid")} value={money.fmt(highestBid)} big={mode === "sell"} hint={mode === "sell" ? t("mode.youGet") : undefined} />
        <Metric label={t("detail.sales")} value={formatNumber(l?.quantity)} />
        <Metric label={t("detail.favorites")} value={formatNumber(item.favoriteCount?.total ?? 0)} />
      </div>
      <p className="text-xs text-muted-foreground">{t("detail.snapshot")}</p>

      {/* ステータス (Steam 説明文由来) */}
      <ItemStatCard item={item} tr={tr} />

      {/* 注文板 (LIVE) */}
      <OrderBook itemId={item.id} hash={item.marketHashName} />
      <LiveRefresh />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* グラフ */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("detail.priceHistory")}</CardTitle></CardHeader>
          <CardContent>
            <PriceChart itemId={item.id} forecast={{ f30: a?.forecast30 ?? null }} />
          </CardContent>
        </Card>

        {/* 分析パネル */}
        <Card>
          <CardHeader><CardTitle>{t("detail.analysis")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] leading-snug text-muted-foreground">
              {t("detail.estimateNote")}
            </p>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{t("detail.investScore")}</div>
                <div className="text-3xl font-bold tabular">{a?.investmentScore ?? "—"}<span className="text-base text-muted-foreground">/100</span></div>
              </div>
              {trendColor && a?.trend && <span className={cn("text-sm font-semibold", trendColor)}>{t(`trend.${a.trend}`)}</span>}
            </div>

            {a && <ScoreBreakdown a={a} labels={{
              scorePrice: t("score.price"), scoreVolume: t("score.volume"), scoreStability: t("score.stability"),
              scoreVolatility: t("score.volatility"), scorePopularity: t("score.popularity"),
            }} />}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <KV label={t("detail.fairPrice")} value={money.fmt(a?.fairPrice)} />
              <KV label={t("detail.undervalued")} value={a?.undervaluedRate ? formatBps(a.undervaluedRate) : "—"} valueClass="text-up" />
              <KV label={t("detail.ma7")} value={money.fmt(a?.ma7)} />
              <KV label={t("detail.ma30")} value={money.fmt(a?.ma30)} />
              <KV label={t("detail.ma90")} value={money.fmt(a?.ma90)} />
              <KV label={t("detail.volatility")} value={a?.volatility != null ? formatBps(a.volatility) : "—"} />
            </div>

            {/* 将来予測 */}
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("detail.forecast")} ({t("detail.confidence")} {a?.forecastConf ?? "—"}%)</div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Forecast label={t("detail.f7")} value={money.fmt(a?.forecast7)} />
                <Forecast label={t("detail.f30")} value={money.fmt(a?.forecast30)} />
                <Forecast label={t("detail.f90")} value={money.fmt(a?.forecast90)} />
              </div>
              {a?.forecastLow != null && a?.forecastHigh != null && (
                <div className="mt-2 text-center text-xs text-muted-foreground tabular">
                  {t("detail.range30")}: {money.fmt(a.forecastLow)} 〜 {money.fmt(a.forecastHigh)}
                </div>
              )}
            </div>

            {/* AIコメント */}
            {a?.aiComment && (
              <div className="rounded-lg bg-primary/5 p-3 text-sm leading-relaxed">
                <span className="mb-1 block text-xs font-semibold text-primary">{t("detail.aiComment")}</span>
                {a.aiComment}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 広告: グラフ下 */}
      <AdInContent placement="detail_chart" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 価格推移(推定) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("detail.trades")}</CardTitle>
            <span className="text-xs text-muted-foreground">{t("detail.simulated")}</span>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">{t("detail.date")}</th><th className="px-3 py-2 text-right">{t("common.price")}</th><th className="px-3 py-2 text-right">{t("common.qty")}</th></tr>
                </thead>
                <tbody>
                  {trades.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">{formatDateTime(row.timestamp).slice(0, 10)}</td>
                      <td className="px-3 py-1.5 text-right font-medium tabular">{money.fmt(row.price)}</td>
                      <td className="px-3 py-1.5 text-right tabular text-muted-foreground">{formatNumber(row.quantity)}</td>
                    </tr>
                  ))}
                  {trades.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">{t("detail.noHistory")}</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* アラート設定 */}
        <Card>
          <CardHeader><CardTitle>{t("detail.setAlert")}</CardTitle></CardHeader>
          <CardContent>
            <AlertForm itemId={item.id} currentPrice={l?.lowestPrice ?? null} />
          </CardContent>
        </Card>
      </div>

      {/* 広告: 関連アイテム上 */}
      <AdInContent placement="detail_related" />

      {/* 関連アイテム */}
      {related.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-bold">{t("detail.related")}</h2>
          <ItemTable items={related} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, big, hint }: { label: string; value: React.ReactNode; big?: boolean; hint?: string }) {
  return (
    <Card className={hint ? "border-primary/50" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {hint && <span className="font-semibold text-primary">{hint}</span>}
        </div>
        <div className={cn("mt-0.5 font-bold tabular", big ? "text-xl text-primary" : "text-base")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function KV({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("font-medium tabular", valueClass)}>{value}</div>
    </div>
  );
}

function Forecast({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular">{value}</div>
    </div>
  );
}
