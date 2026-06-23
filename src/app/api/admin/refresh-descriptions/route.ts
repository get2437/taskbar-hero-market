import { NextRequest, NextResponse } from "next/server";
import { refreshDescriptions } from "@/lib/jobs";
import { isAdmin } from "@/lib/admin-auth";
import { captureException } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 説明文(ステータス)を手動で再取得する。全件は数分かかるため:
 *   ?max=N を付けると同期で N 件だけ処理して結果を返す (N×interval が maxDuration 内)。
 *   省略時はバックグラウンド実行(fire-and-forget)し 202 を返す (VPS常駐前提)。
 */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const maxParam = req.nextUrl.searchParams.get("max");
  const max = maxParam ? Math.max(1, Math.min(5000, parseInt(maxParam, 10) || 0)) : null;

  if (max != null) {
    try {
      const result = await refreshDescriptions(max);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  // 全件はバックグラウンドで (応答を待たない)
  refreshDescriptions().catch((e) => captureException(e, { source: "api/refresh-descriptions", level: "error" }));
  return NextResponse.json({ started: true, message: "descriptions refresh started in background" }, { status: 202 });
}
