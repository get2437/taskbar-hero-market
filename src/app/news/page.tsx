import type { Metadata } from "next";
import { ExternalLink, Languages } from "lucide-react";
import { getNews, getDevPosts, type NewsView } from "@/lib/steam/news";
import { getTranslator } from "@/lib/i18n/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("news.title"), description: t("news.sub") };
}

function NewsCard({ n, locale, t }: { n: NewsView; locale: string; t: (k: string) => string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="text-base font-semibold">{n.title}</h2>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTime(n.publishedAt)} · TBH: Task Bar Hero
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{n.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-primary hover:bg-accent">
            {t("news.readOnSteam")} <ExternalLink className="h-3 w-3" />
          </a>
          {!n.translated && locale !== "en" && (
            <a
              href={`https://translate.google.com/translate?sl=en&tl=${locale}&u=${encodeURIComponent(n.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground hover:bg-accent"
            >
              {t("news.translate")} <Languages className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function NewsPage() {
  const { t, locale } = await getTranslator();
  const [news, devPosts] = await Promise.all([getNews(locale, 12), getDevPosts(locale, 12)]);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t("news.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("news.sub")}</p>
        </div>
        {news.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("news.empty")}</div>
        ) : (
          <div className="space-y-3">
            {news.map((n) => <NewsCard key={n.gid} n={n} locale={locale} t={t} />)}
          </div>
        )}
      </section>

      {devPosts.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{t("news.devTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("news.devSub")}</p>
          </div>
          <div className="space-y-3">
            {devPosts.map((n) => <NewsCard key={n.gid} n={n} locale={locale} t={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}
