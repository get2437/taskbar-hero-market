import { NextRequest, NextResponse } from "next/server";
import { translateItemNames, translateStatLines } from "@/lib/steam/name-translate";
import { isAdmin } from "@/lib/admin-auth";
import { refreshState } from "@/lib/refresh-state";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * アイテム名の機械翻訳をオンデマンドで起動する (Claude API)。
 * ?all=true で全件、省略時は未翻訳のみ。全件は数十秒〜数分かかるためバックグラウンド起動し、
 * 進行状態を refreshState 経由で返す (UIがポーリングして完了検知)。
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (refreshState.running) return NextResponse.json({ started: false, running: true });
  const onlyMissing = req.nextUrl.searchParams.get("all") !== "true";

  refreshState.running = true;
  refreshState.kind = "names";
  refreshState.startedAt = Date.now();
  refreshState.finishedAt = null;
  refreshState.progress = null;
  refreshState.result = null;
  refreshState.error = null;

  // アイテム名 → 特殊ステータス効果文 の順に機械翻訳する。
  (async () => {
    const names = await translateItemNames({ onlyMissing, onProgress: (current, total) => { refreshState.progress = { phase: "names", current, total }; } });
    const stats = await translateStatLines({ onlyMissing, onProgress: (current, total) => { refreshState.progress = { phase: "stats", current, total }; } });
    return { updated: names.updated + stats.updated, total: names.total + stats.total };
  })()
    .then(async (r) => {
      refreshState.result = { updated: r.updated, total: r.total };
      await invalidate("items:");
      await invalidate("dashboard");
    })
    .catch((e: unknown) => {
      refreshState.error = e instanceof Error ? e.message : String(e);
    })
    .finally(() => {
      refreshState.running = false;
      refreshState.finishedAt = Date.now();
      refreshState.progress = null;
    });

  return NextResponse.json({ started: true, kind: "names" });
}
