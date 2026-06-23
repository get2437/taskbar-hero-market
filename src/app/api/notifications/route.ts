import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return NextResponse.json({ notifications, unread });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  if (body?.id) {
    await prisma.notification.updateMany({ where: { id: body.id, userId }, data: { read: true } });
  } else {
    await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
