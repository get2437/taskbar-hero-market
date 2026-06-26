import { NextRequest, NextResponse } from "next/server";
import { runRefresh } from "@/lib/jobs";
import { isAdmin } from "@/lib/admin-auth";
import { refreshState } from "@/lib/refresh-state";
import { isLocked, STEAM_JOB_LOCK } from "@/lib/lock";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 同一プロセスの進行中 or 別プロセス(worker)がロック保持中なら二重起動しない。
  if (refreshState.running || (await isLocked(STEAM_JOB_LOCK))) {
    return NextResponse.json({ started: false, running: true });
  }
  const doFetch = req.nextUrl.searchParams.get("fetch") !== "false";
  const kind = doFetch ? "refresh" : "reanalyze";

  // 全件取得は数分かかるため即時バックグラウンド起動し、状態だけ返す（nginx タイムアウト回避）。
  refreshState.running = true;
  refreshState.kind = kind;
  refreshState.startedAt = Date.now();
  refreshState.finishedAt = null;
  refreshState.progress = null;
  refreshState.result = null;
  refreshState.error = null;

  runRefresh({ fetch: doFetch, onProgress: (p) => { refreshState.progress = p; } })
    .then((r) => {
      refreshState.result = r;
    })
    .catch((e: unknown) => {
      refreshState.error = e instanceof Error ? e.message : String(e);
    })
    .finally(() => {
      refreshState.running = false;
      refreshState.finishedAt = Date.now();
      refreshState.progress = null;
    });

  return NextResponse.json({ started: true, kind });
}
