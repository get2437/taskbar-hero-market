import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/steam/news";
import { cached } from "@/lib/redis";

export const dynamic = "force-dynamic";

const LOCALES = new Set(["en", "ja", "ko", "zh", "ru"]);

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") ?? "en";
  const loc = LOCALES.has(locale) ? locale : "en";
  const news = await cached(`news:${loc}`, 300, () => getNews(loc, 10));
  return NextResponse.json({ news });
}
