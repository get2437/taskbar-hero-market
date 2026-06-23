import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  const alerts = await prisma.priceAlert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { item: { include: { latest: true } } },
  });
  return NextResponse.json({ alerts });
}

const createSchema = z.object({
  itemId: z.string().min(1),
  condition: z.enum(["PRICE_BELOW", "PRICE_ABOVE", "CHANGE_UP", "CHANGE_DOWN", "SPIKE_UP", "SPIKE_DOWN", "VOLUME_SPIKE"]),
  threshold: z.number().int().optional(),
  channel: z.enum(["WEB", "DISCORD", "EMAIL"]).default("WEB"),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const alert = await prisma.priceAlert.create({ data: { userId, ...parsed.data } });
  return NextResponse.json({ alert });
}
