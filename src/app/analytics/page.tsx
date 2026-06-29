import type { Metadata } from "next";
import { getTranslator } from "@/lib/i18n/server";
import { getPageViewBuckets } from "@/lib/analytics";
import { AnalyticsView } from "@/components/analytics-view";
import { CHANGELOG } from "@/lib/changelog";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("analytics.title"), description: t("analytics.sub"), robots: { index: false, follow: false } };
}

export default async function AnalyticsPage() {
  const { t, locale } = await getTranslator();
  const data = await getPageViewBuckets();
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("analytics.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("analytics.sub")}</p>
      </div>
      <AnalyticsView data={data} />

      {/* 更新履歴（人間向け・新しい順） */}
      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg font-bold">{t("cl.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("cl.sub")}</p>
        </div>
        <ol className="space-y-3">
          {CHANGELOG.map((e, i) => (
            <li key={i} className="rounded-lg border bg-card p-4">
              <time className="text-xs font-medium text-muted-foreground" dateTime={e.at}>
                {dateFmt.format(new Date(e.at))}
              </time>
              <div className="mt-1 font-semibold">{t(e.title)}</div>
              {e.detail && <p className="mt-1 text-sm text-muted-foreground">{t(e.detail)}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
