import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ enabled: z.boolean().optional(), threshold: z.number().int().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const alert = await prisma.priceAlert.findFirst({ where: { id, userId } });
  if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const updated = await prisma.priceAlert.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ alert: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const alert = await prisma.priceAlert.findFirst({ where: { id, userId } });
  if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.priceAlert.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
