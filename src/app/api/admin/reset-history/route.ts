import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * シード由来の偽データ掃除。実データに見せかかっていたものを実値へ戻す。
 *  - 価格履歴 / スナップショット: シードの合成ランダムウォークを全削除(現在価格は維持)。
 *  - 騰落率(前日/7日/30日): 履歴依存なのでクリア(次回取得で再計算)。
 *  - 未解決の異常(Anomaly): 合成履歴から検出された偽の異常を削除。
 *  - お気に入り数(FavoriteStat): 乱数シード値を捨て、実お気に入り件数で再計算。
 * 実行後はチャート/騰落率/予測が一旦まばらになるが、15分毎の取得で正しい実データが積み上がる。
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [hist, snap] = await prisma.$transaction([
      prisma.priceHistory.deleteMany({}),
      prisma.marketSnapshot.deleteMany({}),
    ]);
    // 騰落率は履歴依存なのでクリア(次回取得で再計算される)
    await prisma.itemLatest.updateMany({ data: { changePrev: null, change7d: null, change30d: null } });
    // 合成履歴から検出された偽の異常を削除
    const anom = await prisma.anomaly.deleteMany({ where: { resolved: false } });

    // お気に入り数を実データ(Favorite件数)で再計算。捏造シード値を捨てる。
    const grouped = await prisma.favorite.groupBy({ by: ["itemId"], _count: { _all: true } });
    const realCount = new Map(grouped.map((g) => [g.itemId, g._count._all]));
    await prisma.favoriteStat.updateMany({ data: { last24h: 0 } });
    const stats = await prisma.favoriteStat.findMany({ select: { itemId: true } });
    let favFixed = 0;
    for (const s of stats) {
      await prisma.favoriteStat.update({ where: { itemId: s.itemId }, data: { total: realCount.get(s.itemId) ?? 0 } });
      favFixed++;
    }

    await invalidate("history:");
    await invalidate("items:");
    await invalidate("ranking:");
    await invalidate("dashboard");
    return NextResponse.json({
      ok: true,
      removedHistory: hist.count,
      removedSnapshots: snap.count,
      clearedAnomalies: anom.count,
      favoritesRecomputed: favFixed,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
