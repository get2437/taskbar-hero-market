import type { Metadata } from "next";
import { getTranslator } from "@/lib/i18n/server";
import { getPageViewBuckets } from "@/lib/analytics";
import { AnalyticsView } from "@/components/analytics-view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("analytics.title"), description: t("analytics.sub"), robots: { index: false, follow: false } };
}

export default async function AnalyticsPage() {
  const { t } = await getTranslator();
  const data = await getPageViewBuckets();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("analytics.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("analytics.sub")}</p>
      </div>
      <AnalyticsView data={data} />
    </div>
  );
}
