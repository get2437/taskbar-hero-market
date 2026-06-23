import { NextRequest, NextResponse } from "next/server";
import { getPriceHistory } from "@/lib/queries";
import { cached } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const range = req.nextUrl.searchParams.get("range") ?? "30d";
  const data = await cached(`history:${id}:${range}`, 60, () => getPriceHistory(id, range));
  return NextResponse.json({ range, points: data });
}
