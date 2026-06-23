import { NextRequest, NextResponse } from "next/server";
import { getItemsForCompare } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** 比較するアイテムのステータスを返す。 GET ?ids=a,b,c */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ items: [] });
  const items = await getItemsForCompare(ids);
  return NextResponse.json({ items });
}
