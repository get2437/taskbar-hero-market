"use client";
import { useState } from "react";
import { ExternalLink, Languages } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { NewsView } from "@/lib/steam/news";

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

/** ニュース / 開発者コメント をタブで切り替える。 */
export function NewsTabs({ news, devPosts }: { news: NewsView[]; devPosts: NewsView[] }) {
  const { t, locale } = useT();
  const [tab, setTab] = useState<"news" | "dev">("news");
  const list = tab === "news" ? news : devPosts;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "news" | "dev")}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="news">{t("news.title")}</TabsTrigger>
          {devPosts.length > 0 && <TabsTrigger value="dev">{t("news.devTitle")}</TabsTrigger>}
        </TabsList>
      </Tabs>

      <p className="text-sm text-muted-foreground">{tab === "news" ? t("news.sub") : t("news.devSub")}</p>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("news.empty")}</div>
      ) : (
        <div className="space-y-3">
          {list.map((n) => <NewsCard key={n.gid} n={n} locale={locale} t={t} />)}
        </div>
      )}
    </div>
  );
}
