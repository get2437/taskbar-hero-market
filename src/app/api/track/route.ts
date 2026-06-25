import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * ページビュー記録。クライアントの軽量beaconから呼ばれ、1閲覧=1行を保存する。
 * - 管理画面/APIは集計対象外(オーナー操作のため)。
 * - JSを実行しないbotは基本ここに来ない(=実ユーザー寄りの計測)。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    let path = typeof body?.path === "string" ? body.path : "";
    if (!path.startsWith("/")) return NextResponse.json({ ok: false }, { status: 204 });
    // クエリ/ハッシュは落として正規化、長さ制限
    path = path.split(/[?#]/)[0].slice(0, 200);
    // オーナー用の画面/APIは集計対象外
    if (path.startsWith("/admin") || path.startsWith("/analytics") || path.startsWith("/api")) {
      return new NextResponse(null, { status: 204 });
    }
    await prisma.pageView.create({ data: { path } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
