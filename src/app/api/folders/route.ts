import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { listFolders } from "@/lib/favorites";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  const folders = await listFolders(userId);
  return NextResponse.json({ folders });
}

const createSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "name required" }, { status: 400 });
  const count = await prisma.folder.count({ where: { userId } });
  const folder = await prisma.folder.create({
    data: { userId, name: parsed.data.name, color: parsed.data.color ?? "#64748b", sortOrder: count },
  });
  return NextResponse.json({ folder });
}
