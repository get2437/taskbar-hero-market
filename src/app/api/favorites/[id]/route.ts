import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  memo: z.string().max(2000).nullable().optional(),
  folderId: z.string().nullable().optional(),
  purchasePrice: z.number().int().nonnegative().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const fav = await prisma.favorite.findFirst({ where: { id, userId } });
  if (!fav) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const updated = await prisma.favorite.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ favorite: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const fav = await prisma.favorite.findFirst({ where: { id, userId } });
  if (!fav) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.favorite.delete({ where: { id } });
  await prisma.favoriteStat.updateMany({ where: { itemId: fav.itemId }, data: { total: { decrement: 1 } } });
  return NextResponse.json({ ok: true });
}
