import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 公開ヘルスチェック (Uptime監視・ロードバランサ用)。トークン不要。
 * DBに軽くpingして、OKなら200 / DB不通なら503 を返す。
 */
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    /* db down */
  }
  return NextResponse.json(
    { status: db ? "ok" : "degraded", db, time: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
