import { NextRequest, NextResponse } from "next/server";
import { refreshDescriptions } from "@/lib/jobs";
import { isAdmin } from "@/lib/admin-auth";
import { refreshState } from "@/lib/refresh-state";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 説明文(基礎/固有/特殊ステータス・必要Lv・スロット・素材分類)を手動で再取得する。
 *   ?max=N を付けると同期で N 件だけ処理して結果を返す (N×interval が maxDuration 内・デバッグ用)。
 *   省略時はバックグラウンド実行し、進行状態を refreshState 経由で返す (UIがポーリングして完了検知)。
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const maxParam = req.nextUrl.searchParams.get("max");
  const max = maxParam ? Math.max(1, Math.min(5000, parseInt(maxParam, 10) || 0)) : null;
  if (max != null) {
    try {
      const result = await refreshDescriptions({ maxItems: max });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  if (refreshState.running) return NextResponse.json({ started: false, running: true });

  refreshState.running = true;
  refreshState.kind = "descriptions";
  refreshState.startedAt = Date.now();
  refreshState.finishedAt = null;
  refreshState.progress = null;
  refreshState.result = null;
  refreshState.error = null;

  refreshDescriptions({ onProgress: (p) => { refreshState.progress = p; } })
    .then((r) => {
      refreshState.result = { updated: r.updated, total: r.total };
    })
    .catch((e: unknown) => {
      refreshState.error = e instanceof Error ? e.message : String(e);
    })
    .finally(() => {
      refreshState.running = false;
      refreshState.finishedAt = Date.now();
      refreshState.progress = null;
    });

  return NextResponse.json({ started: true, kind: "descriptions" });
}
