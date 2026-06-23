import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderBook } from "@/lib/steam/orderbook";
import { markHot } from "@/lib/hot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id }, select: { marketHashName: true } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  await markHot(id); // 閲覧中=ホット → ワーカーが優先最新化
  try {
    const book = await getOrderBook(item.marketHashName);
    return NextResponse.json(book);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, sell: [], buy: [], sellCount: 0, buyCount: 0 }, { status: 200 });
  }
}
