import type { Metadata } from "next";
import { getNews, getDevPosts } from "@/lib/steam/news";
import { getTranslator } from "@/lib/i18n/server";
import { NewsTabs } from "@/components/news-tabs";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return { title: t("news.title"), description: t("news.sub"), ...(site ? { alternates: { canonical: `${site}/news` } } : {}) };
}

export default async function NewsPage() {
  const { t, locale } = await getTranslator();
  const [news, devPosts] = await Promise.all([getNews(locale, 12), getDevPosts(locale, 12)]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("news.title")}</h1>
      <NewsTabs news={news} devPosts={devPosts} />
    </div>
  );
}
