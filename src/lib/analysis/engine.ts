/**
 * 分析エンジンの DB 連携層。
 * PriceHistory を読み、ItemAnalysis を upsert し、Anomaly を記録する。
 * scripts/run-analysis.ts と /api/admin/refresh から呼ばれる。
 */
import { prisma } from "@/lib/prisma";
import {
  type PricePoint,
  movingAverage,
  volatilityBps,
  detectTrend,
  estimateFairValue,
  investmentScore,
  detectPriceAnomalies,
  detectVolumeAnomalies,
  forecast,
  generateComment,
} from "./core";

const DAY = 86_400_000;

/** 全アイテムを分析して結果を保存。戻り値は処理件数。 */
export async function runAnalysis(now = Date.now()): Promise<{ analyzed: number; anomalies: number }> {
  const items = await prisma.item.findMany({
    where: { active: true },
    include: {
      latest: true,
      priceHistory: {
        where: { timestamp: { gte: new Date(now - 95 * DAY) } },
        orderBy: { timestamp: "asc" },
      },
      favoriteCount: true,
    },
  });

  // 市場人気度のための分布 (出来高 / お気に入り)
  const avgVolumes = items.map((it) => avgDailyQuantity(toPoints(it.priceHistory), now));
  const favTotals = items.map((it) => it.favoriteCount?.total ?? 0);
  const volRank = percentileRanker(avgVolumes);
  const favRank = percentileRanker(favTotals);

  let anomalyCount = 0;

  for (const it of items) {
    const points = toPoints(it.priceHistory);
    const current = it.latest?.lowestPrice ?? it.latest?.medianPrice ?? lastPrice(points);

    const ma7 = movingAverage(points, 7, now);
    const ma30 = movingAverage(points, 30, now);
    const ma90 = movingAverage(points, 90, now);
    const vol = volatilityBps(points, 30, now);
    const trend = detectTrend(points, 30, now);
    const fair = estimateFairValue(current, ma7, ma30, ma90);
    const avgQty = avgDailyQuantity(points, now);

    const score = investmentScore({
      currentPrice: current,
      ma30,
      trend,
      volatilityBps: vol,
      avgQuantity: avgQty,
      volumePercentile: volRank(avgQty),
      favoritePercentile: favRank(it.favoriteCount?.total ?? 0),
    });

    const fc = forecast(current, trend, vol, points.length);

    const priceAnoms = detectPriceAnomalies(points, now);
    const volAnoms = detectVolumeAnomalies(points, now);

    const comment = generateComment({
      fair,
      trend,
      score,
      priceAnomalies: priceAnoms,
      volumeAnomaly: volAnoms[0],
    });

    await prisma.itemAnalysis.upsert({
      where: { itemId: it.id },
      create: {
        itemId: it.id,
        ma7, ma30, ma90, volatility: vol,
        fairPrice: fair.fairPrice,
        undervaluedRate: fair.undervaluedRate,
        overvaluedRate: fair.overvaluedRate,
        trend: trend.trend,
        investmentScore: score.total,
        riskLevel: score.riskLevel,
        recommendation: score.recommendation,
        scorePrice: score.price,
        scoreVolume: score.volume,
        scoreStability: score.stability,
        scoreVolatility: score.volatility,
        scorePopularity: score.popularity,
        forecast7: fc.forecast7,
        forecast30: fc.forecast30,
        forecast90: fc.forecast90,
        forecastLow: fc.low,
        forecastHigh: fc.high,
        forecastConf: fc.confidence,
        aiComment: comment,
      },
      update: {
        ma7, ma30, ma90, volatility: vol,
        fairPrice: fair.fairPrice,
        undervaluedRate: fair.undervaluedRate,
        overvaluedRate: fair.overvaluedRate,
        trend: trend.trend,
        investmentScore: score.total,
        riskLevel: score.riskLevel,
        recommendation: score.recommendation,
        scorePrice: score.price,
        scoreVolume: score.volume,
        scoreStability: score.stability,
        scoreVolatility: score.volatility,
        scorePopularity: score.popularity,
        forecast7: fc.forecast7,
        forecast30: fc.forecast30,
        forecast90: fc.forecast90,
        forecastLow: fc.low,
        forecastHigh: fc.high,
        forecastConf: fc.confidence,
        aiComment: comment,
      },
    });

    // 異常値を記録 (同一ウィンドウの未解決を重複させない)
    for (const a of [...priceAnoms, ...volAnoms]) {
      const existing = await prisma.anomaly.findFirst({
        where: { itemId: it.id, type: a.type, window: a.window, resolved: false, detectedAt: { gte: new Date(now - DAY) } },
      });
      if (!existing) {
        await prisma.anomaly.create({
          data: { itemId: it.id, type: a.type, window: a.window, changeBps: a.changeBps },
        });
        anomalyCount++;
      }
    }
  }

  return { analyzed: items.length, anomalies: anomalyCount };
}

// --- helpers ---

function toPoints(history: { price: number; quantity: number; timestamp: Date }[]): PricePoint[] {
  return history.map((h) => ({ t: h.timestamp.getTime(), price: h.price, quantity: h.quantity }));
}

function lastPrice(points: PricePoint[]): number | null {
  if (points.length === 0) return null;
  return points[points.length - 1].price;
}

function avgDailyQuantity(points: PricePoint[], now: number): number {
  const win = points.filter((p) => p.t >= now - 30 * DAY);
  if (win.length === 0) return 0;
  const total = win.reduce((a, p) => a + p.quantity, 0);
  return total / 30;
}

/** 値配列から「ある値の昇順パーセンタイル(0-1)」を返す関数を作る。 */
function percentileRanker(values: number[]): (v: number) => number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return (v: number) => {
    if (n === 0) return 0;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return n <= 1 ? 0.5 : lo / (n - 1);
  };
}
