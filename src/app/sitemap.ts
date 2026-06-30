import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/gear`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/materials`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/rankings`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/dashboard`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE}/anomalies`, changeFrequency: "hourly", priority: 0.6 },
    { url: `${BASE}/news`, changeFrequency: "daily", priority: 0.6 },
  ];

  // アイテム詳細 (DB未接続でも静的ルートは返す)
  let items: { id: string; updatedAt: Date }[] = [];
  try {
    items = await prisma.item.findMany({
      where: { active: true },
      select: { id: true, updatedAt: true },
      orderBy: { latest: { quantity: "desc" } },
      take: 2000,
    });
  } catch {
    /* DB未接続: 静的ルートのみ */
  }

  const itemRoutes: MetadataRoute.Sitemap = items.map((i) => ({
    url: `${BASE}/items/${i.id}`,
    lastModified: i.updatedAt,
    changeFrequency: "hourly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...itemRoutes];
}
