import { NextRequest, NextResponse } from "next/server";
import { getRanking, type RankingKind } from "@/lib/queries";
import { cached } from "@/lib/redis";

export const dynamic = "force-dynamic";

const VALID: RankingKind[] = ["gainers", "losers", "volume", "expensive", "rare", "buy", "sell", "favorites"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!VALID.includes(kind as RankingKind)) {
    return NextResponse.json({ error: "invalid ranking kind" }, { status: 400 });
  }
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50);
  const data = await cached(`ranking:${kind}:${limit}`, 30, () => getRanking(kind as RankingKind, limit));
  return NextResponse.json({ kind, items: data });
}
