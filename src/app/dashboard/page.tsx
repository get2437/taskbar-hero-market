import Link from "next/link";
import { getMarketSummary, getRanking, getAnomalies } from "@/lib/queries";
import { getFavoriteSummary } from "@/lib/favorites";
import { getCurrentUserId } from "@/lib/session";
import { StatCard } from "@/components/stat-card";
import { DashboardRankings } from "@/components/dashboard-rankings";
import { ItemTable } from "@/components/item-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnomalyList } from "@/components/anomaly-list";
import { formatNumber } from "@/lib/utils";
import { getTranslator } from "@/lib/i18n/server";
import { getMoney } from "@/lib/money/server";
import { getMode } from "@/lib/mode/server";
import { LiveRefresh } from "@/components/live-refresh";
import { AdBanner } from "@/components/ads";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { t } = await getTranslator();
  const money = await getMoney();
  const mode = await getMode();
  const userId = await getCurrentUserId();
  const [summary, gainers, losers, volume, expensive, rare, buy, sell, anomalies, favSummary] =
    await Promise.all([
      getMarketSummary(),
      getRanking("gainers", 50),
      getRanking("losers", 50),
      getRanking("volume", 50),
      getRanking("expensive", 50),
      getRanking("rare", 50),
      getRanking("buy", 8),
      getRanking("sell", 8),
      getAnomalies(12),
      getFavoriteSummary(userId),
    ]);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl font-bold">{t("dash.title")}</h1>
        <p className="text-sm text-muted-foreground">{mode === "buy" ? t("dash.subBuy") : t("dash.subSell")}</p>
      </div>

      {/* 市場サマリ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t("dash.marketCap")} value={money.fmt(summary.marketCap)} accent="primary" />
        <StatCard label={t("dash.volume")} value={formatNumber(summary.totalVolume)} />
        <StatCard label={t("dash.upToday")} value={formatNumber(summary.upCount)} accent="up" />
        <StatCard label={t("dash.downToday")} value={formatNumber(summary.downCount)} accent="down" />
        <StatCard label={t("dash.anomalies")} value={formatNumber(summary.anomalyCount)} accent="warning" sub={t("dash.last24h")} />
        <StatCard label={t("dash.dead")} value={formatNumber(summary.deadCount)} sub={t("dash.deadSub")} />
      </div>

      {/* お気に入りサマリ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("dash.favCount")} value={formatNumber(favSummary.count)} />
        <StatCard label={t("dash.favUp")} value={formatNumber(favSummary.upToday)} accent="up" sub={t("dash.today")} />
        <StatCard label={t("dash.favDown")} value={formatNumber(favSummary.downToday)} accent="down" sub={t("dash.today")} />
        <StatCard
          label={t("dash.pl")}
          value={favSummary.totalProfitAfterFee == null ? "—" : money.fmt(favSummary.totalProfitAfterFee)}
          accent={favSummary.totalProfitAfterFee != null && favSummary.totalProfitAfterFee >= 0 ? "up" : "down"}
        />
      </div>

      {/* 広告: ファーストビュー下 */}
      <AdBanner placement="home_top" />

      {/* 今買うべき / 売り時 (モードで強調・並べ替え) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(() => {
          const buyCard = (
            <Card key="buy" className={mode === "buy" ? "border-up/50" : ""}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-up">📈 {t("dash.buyRank")}</CardTitle>
                <Link href="/rankings?kind=buy" className="text-xs text-muted-foreground hover:underline">{t("common.seeAll")}</Link>
              </CardHeader>
              <CardContent>
                <ItemTable items={buy} rank emptyText={t("dash.emptyBuy")} />
              </CardContent>
            </Card>
          );
          const sellCard = (
            <Card key="sell" className={mode === "sell" ? "border-down/50" : ""}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-down">📉 {t("dash.sellRank")}</CardTitle>
                <Link href="/rankings?kind=sell" className="text-xs text-muted-foreground hover:underline">{t("common.seeAll")}</Link>
              </CardHeader>
              <CardContent>
                <ItemTable items={sell} rank emptyText={t("dash.emptySell")} />
              </CardContent>
            </Card>
          );
          return mode === "buy" ? [buyCard, sellCard] : [sellCard, buyCard];
        })()}
      </div>

      {/* 各種ランキング */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dash.rankings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardRankings gainers={gainers} losers={losers} volume={volume} expensive={expensive} rare={rare} />
        </CardContent>
      </Card>

      {/* 異常検知速報 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>⚡ {t("dash.anomalyFeed")}</CardTitle>
          <Link href="/anomalies" className="text-xs text-muted-foreground hover:underline">{t("common.seeAll")}</Link>
        </CardHeader>
        <CardContent>
          <AnomalyList anomalies={anomalies} />
        </CardContent>
      </Card>

      {/* 広告: フッター上 */}
      <AdBanner placement="home_bottom" />
    </div>
  );
}
