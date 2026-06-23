import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { listFavorites, toggleFavorite, type FavoriteSort } from "@/lib/favorites";
import { invalidate } from "@/lib/redis";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const folderId = req.nextUrl.searchParams.get("folderId");
  const sort = (req.nextUrl.searchParams.get("sort") as FavoriteSort) ?? "created";
  const favorites = await listFavorites(userId, folderId, sort);
  return NextResponse.json({ favorites });
}

const toggleSchema = z.object({ itemId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  const result = await toggleFavorite(userId, parsed.data.itemId);
  await invalidate("dashboard");
  await invalidate("ranking:favorites");
  return NextResponse.json(result);
}
