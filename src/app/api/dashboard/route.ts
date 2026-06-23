import { NextResponse } from "next/server";
import { getMarketSummary, getRanking } from "@/lib/queries";
import { cached } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await cached("dashboard", 30, async () => {
    const [summary, gainers, losers, volume, expensive, rare, buy, sell] = await Promise.all([
      getMarketSummary(),
      getRanking("gainers", 50),
      getRanking("losers", 50),
      getRanking("volume", 50),
      getRanking("expensive", 50),
      getRanking("rare", 50),
      getRanking("buy", 10),
      getRanking("sell", 10),
    ]);
    return { summary, gainers, losers, volume, expensive, rare, buy, sell };
  });
  return NextResponse.json(data);
}
