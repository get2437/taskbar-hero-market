import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 価格履歴のリセット。
 * シード時に生成した合成ランダムウォーク(偽の推移)を消し、以後は実取得スナップショットだけで
 * 推移を積み上げる。Item / ItemLatest / 分析設定は残す(現在価格は維持)。
 * 実行後はチャートが一旦まばらになるが、15分毎の取得で正しい実データが溜まる。
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [hist, snap] = await prisma.$transaction([
      prisma.priceHistory.deleteMany({}),
      prisma.marketSnapshot.deleteMany({}),
    ]);
    // 変化率(前日/7日/30日)は履歴依存なのでクリア(次回取得で再計算される)
    await prisma.itemLatest.updateMany({ data: { changePrev: null, change7d: null, change30d: null } });
    await invalidate("history:");
    await invalidate("items:");
    await invalidate("dashboard");
    return NextResponse.json({ ok: true, removedHistory: hist.count, removedSnapshots: snap.count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
