import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/favorites"], // 管理・API・個人ページは除外
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
