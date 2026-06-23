import { NextResponse } from "next/server";
import { getAnomalies } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const anomalies = await getAnomalies(50);
  return NextResponse.json({
    anomalies: anomalies.map((a) => ({
      id: a.id,
      type: a.type,
      window: a.window,
      changeBps: a.changeBps,
      detectedAt: a.detectedAt,
      item: {
        id: a.item.id,
        name: a.item.name,
        imageUrl: a.item.imageUrl,
        lowestPrice: a.item.latest?.lowestPrice ?? null,
      },
    })),
  });
}
