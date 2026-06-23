import { NextRequest, NextResponse } from "next/server";
import { getItemDetail, getRecentTrades } from "@/lib/queries";
import { getCurrentUserId } from "@/lib/session";
import { isFavorited } from "@/lib/favorites";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemDetail(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [trades, userId] = await Promise.all([getRecentTrades(id), getCurrentUserId()]);
  const favorited = await isFavorited(userId, id);
  return NextResponse.json({ item, trades, favorited });
}
