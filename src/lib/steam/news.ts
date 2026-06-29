/**
 * Steam ニュース (ISteamNews/GetNewsForApp) の取得・保存・取得層。
 * 原文(英語)を NewsArticle にキャッシュし、translations(JSON)に言語別タイトル/要約を持てる。
 */
import { prisma } from "@/lib/prisma";
import { steamFetchJson } from "./http";

const APP_ID = Number(process.env.STEAM_APP_ID ?? 3678970);

export interface NewsTranslation {
  title: string;
  summary: string;
}
// 英語以外の対応言語 (UIと同じ9言語のうち en を除く8言語)
export const NEWS_LOCALES = ["ja", "ko", "zh", "ru", "pt", "es", "fr", "de", "it", "pl", "tr", "th", "vi"] as const;
export type NewsLocale = (typeof NEWS_LOCALES)[number];
export type NewsTranslations = Partial<Record<NewsLocale, NewsTranslation>>;

// bbcode / HTML タグ除去
function clean(s: string): string {
  return s
    .replace(/\[\/?[^\]]+\]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  contents: string;
  feedlabel?: string;
  date: number;
}

/** Steamから取得して NewsArticle を upsert。戻り値=件数。 */
export async function fetchNews(count = 10): Promise<number> {
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID}&count=${count}&maxlength=0&format=json`;
  const data = await steamFetchJson<any>(url, { retries: 2 });
  if (!data) return 0;
  const items: SteamNewsItem[] = data?.appnews?.newsitems ?? [];
  let n = 0;
  for (const it of items) {
    await prisma.newsArticle.upsert({
      where: { gid: it.gid },
      create: {
        gid: it.gid,
        title: it.title,
        contents: clean(it.contents).slice(0, 4000),
        url: it.url,
        feedLabel: it.feedlabel ?? null,
        publishedAt: new Date(it.date * 1000),
      },
      update: {
        title: it.title,
        contents: clean(it.contents).slice(0, 4000),
        url: it.url,
        feedLabel: it.feedlabel ?? null,
        publishedAt: new Date(it.date * 1000),
        fetchedAt: new Date(),
      },
    });
    n++;
  }
  return n;
}

export interface NewsView {
  gid: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: Date;
  translated: boolean;
}

function mapNews(
  rows: { gid: string; title: string; contents: string; url: string; publishedAt: Date; translations: unknown }[],
  locale: string,
): NewsView[] {
  return rows.map((r) => {
    const tr = (r.translations as NewsTranslations | null) ?? null;
    const t = locale !== "en" && tr ? tr[locale as keyof NewsTranslations] : undefined;
    const summary = (t?.summary ?? r.contents).slice(0, 400);
    return { gid: r.gid, title: t?.title ?? r.title, summary, url: r.url, publishedAt: r.publishedAt, translated: !!t };
  });
}

/** locale 向け公式ニュース。翻訳があれば使い、無ければ原文(英語)にフォールバック。 */
export async function getNews(locale: string, limit = 10): Promise<NewsView[]> {
  const rows = await prisma.newsArticle.findMany({ where: { source: "news" }, orderBy: { publishedAt: "desc" }, take: limit });
  return mapNews(rows, locale);
}

/** locale 向け 掲示板の開発者投稿。表示/翻訳はニュースと同じ。 */
export async function getDevPosts(locale: string, limit = 10): Promise<NewsView[]> {
  const rows = await prisma.newsArticle.findMany({ where: { source: "forum" }, orderBy: { publishedAt: "desc" }, take: limit });
  return mapNews(rows, locale);
}
