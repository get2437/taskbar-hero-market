import { NextRequest, NextResponse } from "next/server";
import { runRefresh } from "@/lib/jobs";
import { isAdmin } from "@/lib/admin-auth";
import { refreshState } from "@/lib/refresh-state";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (refreshState.running) {
    // 既に進行中。二重起動しない。
    return NextResponse.json({ started: false, running: true });
  }
  const doFetch = req.nextUrl.searchParams.get("fetch") !== "false";
  const kind = doFetch ? "refresh" : "reanalyze";

  // 全件取得は数分かかるため即時バックグラウンド起動し、状態だけ返す（nginx タイムアウト回避）。
  refreshState.running = true;
  refreshState.kind = kind;
  refreshState.startedAt = Date.now();
  refreshState.finishedAt = null;
  refreshState.result = null;
  refreshState.error = null;

  runRefresh({ fetch: doFetch })
    .then((r) => {
      refreshState.result = r;
    })
    .catch((e: unknown) => {
      refreshState.error = e instanceof Error ? e.message : String(e);
    })
    .finally(() => {
      refreshState.running = false;
      refreshState.finishedAt = Date.now();
    });

  return NextResponse.json({ started: true, kind });
}
