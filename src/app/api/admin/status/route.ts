import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";
import { monitoringStatus } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [itemCount, snapshotCount, historyCount, anomalyCount, lastLatest, logs] = await Promise.all([
    prisma.item.count(),
    prisma.marketSnapshot.count(),
    prisma.priceHistory.count(),
    prisma.anomaly.count({ where: { resolved: false } }),
    prisma.itemLatest.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    prisma.fetchLog.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);

  return NextResponse.json({
    counts: { itemCount, snapshotCount, historyCount, anomalyCount },
    lastUpdated: lastLatest?.fetchedAt ?? null,
    monitoring: monitoringStatus(),
    logs,
  });
}
